const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const pino = require('pino');
const ExcelJS = require('exceljs');
const Anthropic = require('@anthropic-ai/sdk');
const { XMLParser } = require('fast-xml-parser');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const PORTA = 3000;
const PASTA_AUTH = path.join(__dirname, 'auth');
const ARQ_MENSAGENS = path.join(__dirname, 'data', 'mensagens.json');
const ARQ_CONFIG = path.join(__dirname, 'data', 'config.json');
const ARQ_CONVERSAS = path.join(__dirname, 'data', 'conversas.json');
const ARQ_ESTADO = path.join(__dirname, 'data', 'estado.json');
const ARQ_PEDIDOS = path.join(__dirname, 'data', 'pedidos.xlsx');
const ARQ_PERFUMES = path.join(__dirname, 'data', 'perfumes.json');
const ARQ_NOTAS = path.join(__dirname, 'data', 'notas-fiscais.json');
const PASTA_SISTEMA = path.join(__dirname, '..', 'SISTEMA');
const PASTA_IMAGENS_CATALOGO = path.join(__dirname, '..', 'EDICAO', 'imagens');
const PASTA_IMAGENS_UPLOAD = path.join(__dirname, 'data', 'imagens-produtos');
fs.mkdirSync(PASTA_IMAGENS_UPLOAD, { recursive: true });
const COLUNAS_PEDIDOS = [
  'Data', 'Número', 'Cliente', 'Produto', 'Preço', 'Pagamento', 'Entrega', 'Endereço/Horário',
  'Status', 'Forma de Pagamento Confirmada', 'Data de Vencimento', 'Comprovante Recebido',
  'Lembrete Véspera Enviado', 'Lembrete Dia Enviado'
];
const STATUS_PEDIDO_VALIDOS = ['Pendente', 'Confirmado', 'Cancelado', 'A Prazo'];

const TIPOS_SISTEMA = ['Saudação', 'Saudação Fora do Horário', 'Ausência', 'Fallback', 'Fallback Fora do Horário'];

let sock = null;
let ultimoQR = null;
let statusConexao = 'desconectado'; // desconectado | aguardando_qr | conectado
let numeroConectado = null;
// fila global: processa uma mensagem de cada vez, nunca em paralelo — evita que
// duas mensagens do mesmo cliente cheguem quase juntas e sejam respondidas em
// paralelo antes do "pausado" da primeira valer pra segunda
let filaProcessamento = Promise.resolve();

// ---------- utilidades de dados ----------

function lerJSON(caminho, padrao) {
  try {
    return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
  } catch {
    return padrao;
  }
}

function salvarJSON(caminho, dados) {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf-8');
}

// ---------- estado das conversas (sobrevive a reinícios) ----------

function dataDeHoje() {
  // Usa o fuso horário do Brasil, não UTC — senão o "dia" vira sozinho às 21h
  // (horário local), 3h antes da meia-noite de verdade, resetando saudação/
  // ausência/pausado enquanto ainda é "hoje" pro cliente.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
}

const estadoSalvo = lerJSON(ARQ_ESTADO, {});
const saudadosHoje = new Map(Object.entries(estadoSalvo.saudadosHoje || {})); // jid -> data (YYYY-MM-DD) da última saudação
const ausenciaHoje = new Map(Object.entries(estadoSalvo.ausenciaHoje || {})); // jid -> data da última mensagem de Ausência
// jid -> data (YYYY-MM-DD) em que foi escalado pro atendente. Pausa vale só "pelo resto do dia",
// por isso é um Map com data (igual saudadosHoje/ausenciaHoje) e não um Set permanente.
const pausados = new Map(
  Array.isArray(estadoSalvo.pausados)
    ? estadoSalvo.pausados.map((jid) => [jid, dataDeHoje()]) // migração de um formato antigo (Set) salvo em disco
    : Object.entries(estadoSalvo.pausados || {})
);

function salvarEstado() {
  salvarJSON(ARQ_ESTADO, {
    saudadosHoje: Object.fromEntries(saudadosHoje),
    ausenciaHoje: Object.fromEntries(ausenciaHoje),
    pausados: Object.fromEntries(pausados)
  });
}

function jaFoiSaudadoHoje(jid) {
  return saudadosHoje.get(jid) === dataDeHoje();
}

function marcarSaudadoHoje(jid) {
  saudadosHoje.set(jid, dataDeHoje());
  salvarEstado();
}

function jaEnviouAusenciaHoje(jid) {
  return ausenciaHoje.get(jid) === dataDeHoje();
}

function marcarAusenciaHoje(jid) {
  ausenciaHoje.set(jid, dataDeHoje());
  salvarEstado();
}

function pausadoHoje(jid) {
  return pausados.get(jid) === dataDeHoje();
}

function marcarPausado(jid) {
  pausados.set(jid, dataDeHoje());
  salvarEstado();
}

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

const SAUDACOES = [
  'oi', 'oii', 'oiii', 'ola', 'opa', 'eae', 'e ai',
  'bom dia', 'boa tarde', 'boa noite', 'tudo bem', 'tudo bom',
  'buenos dias', 'buenas tardes', 'buenas noches', 'buenas',
  'hello', 'hi', 'hey'
];

// Considera saudação tanto a palavra sozinha quanto no início de uma frase maior
// (ex: "bom dia, tudo bem?" ou "buenos dias mi madre"), e também quando vem numa
// mensagem separada logo depois da saudação (ex: "Oiii boa noite" + "tudo bem??"
// mandados como duas mensagens distintas) — por isso a pontuação final (?!.) é
// ignorada antes de comparar, pra não escalar pro Fallback só por causa disso.
function ehSaudacao(texto) {
  const normalizado = normalizar(texto).replace(/[!?.]+$/g, '').trim();
  return SAUDACOES.some((s) => normalizado === s || normalizado.startsWith(s + ' ') || normalizado.startsWith(s + ','));
}

function buscarPorTipo(mensagens, tipo) {
  return mensagens.find((m) => m.tipo === tipo && m.ativa !== false) || null;
}

function buscarRespostaRapida(texto, mensagens) {
  const normalizado = normalizar(texto);
  let melhor = null;
  let melhorTamanho = 0;

  for (const item of mensagens) {
    if (item.tipo !== 'Resposta Rápida' || item.ativa === false) continue;
    for (const palavra of item.palavras_chave || []) {
      const pn = normalizar(palavra);
      if (pn && normalizado.includes(pn) && pn.length > melhorTamanho) {
        melhorTamanho = pn.length;
        melhor = item;
      }
    }
  }
  return melhor;
}

function registrarConversa(numero, mensagem, resposta, escalado = false, tipo = null) {
  const conversas = lerJSON(ARQ_CONVERSAS, []);
  conversas.unshift({
    data: new Date().toISOString(),
    numero,
    mensagem,
    resposta,
    escalado,
    tipo,
    needsFollowUp: false
  });
  salvarJSON(ARQ_CONVERSAS, conversas.slice(0, 200));
}

function estaDentroDoHorario(config) {
  if (!config.horarioAbertura || !config.horarioFechamento) return true;

  // usa o horário do Brasil, não o do servidor (o droplet roda em UTC) — mesmo motivo
  // de dataDeHoje() usar timeZone explícito, senão "18h" vira "18h UTC" = 15h no Brasil
  const agora = new Date();
  const horaLocal = agora.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
  const [horaAgora, minutoAgora] = horaLocal.split(':').map(Number);
  const minutosAgora = horaAgora * 60 + minutoAgora;

  const [abreH, abreM] = config.horarioAbertura.split(':').map(Number);
  const [fechaH, fechaM] = config.horarioFechamento.split(':').map(Number);
  const minutosAbre = abreH * 60 + abreM;
  const minutosFecha = fechaH * 60 + fechaM;

  return minutosAgora >= minutosAbre && minutosAgora <= minutosFecha;
}

// ---------- personalização de mensagens (placeholders) ----------

const NOMES_GENERICOS = ['whatsapp business', 'whatsapp', 'usuario', 'usuário', 'user', 'cliente', 'contato'];

function nomeValido(pushName) {
  if (!pushName) return null;
  const nome = pushName.trim();
  if (nome.length < 2 || nome.length > 40) return null;
  if (/^\+?[\d\s()\-]+$/.test(nome)) return null; // parece número de telefone
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'.-]+$/.test(nome)) return null; // contém dígito/emoji/símbolo
  if (NOMES_GENERICOS.includes(normalizar(nome))) return null;

  const primeiroNome = nome.split(/\s+/)[0];
  return primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
}

function substituirPlaceholders(texto, pushName, config, dadosPedido) {
  let resultado = texto.split('[LINK DO CATÁLOGO QUANDO PUBLICAR]').join(config.linkCatalogo || '');

  const nome = nomeValido(pushName);
  if (nome) {
    resultado = resultado.split('[NOME DO CLIENTE]').join(nome);
  } else {
    resultado = resultado
      .replace(/,\s*\[NOME DO CLIENTE\]/g, '')
      .replace(/\[NOME DO CLIENTE\]/g, '');
  }

  if (dadosPedido) {
    resultado = resultado
      .split('[PRODUTO DO PEDIDO]').join(dadosPedido.produto || '')
      .split('[PRECO DO PEDIDO]').join(dadosPedido.preco || '')
      .split('[PAGAMENTO DO PEDIDO]').join(dadosPedido.pagamento || '')
      .split('[ENTREGA DO PEDIDO]').join(dadosPedido.entrega || '');
  }
  return resultado;
}

function extrairTexto(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    null
  );
}

// ---------- registro de pedidos (planilha local) ----------

// Extrai os campos do texto gerado por SISTEMA/script.js no botão "Enviar pedido pelo WhatsApp"
// (formato fixo: "*Campo:* valor" por linha). Se algum campo não existir na mensagem, fica "".
function extrairDadosPedido(texto) {
  const pegar = (rotulo) => {
    const m = texto.match(new RegExp(`\\*${rotulo}:\\*\\s*(.+)`));
    return m ? m[1].trim() : '';
  };
  return {
    cliente: pegar('Cliente'),
    produto: pegar('Produto'),
    preco: pegar('Preço'),
    pagamento: pegar('Forma de pagamento'),
    entrega: pegar('Entrega'),
    enderecoOuHorario: pegar('Endereço') || pegar('Horário de retirada')
  };
}

async function salvarPedidoPlanilha(numero, dados) {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(ARQ_PEDIDOS)) {
    await wb.xlsx.readFile(ARQ_PEDIDOS);
  }
  let ws = wb.getWorksheet('Pedidos');
  if (!ws) {
    ws = wb.addWorksheet('Pedidos');
    ws.addRow(COLUNAS_PEDIDOS);
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((col) => { col.width = 22; });
  }
  ws.addRow([
    new Date().toLocaleString('pt-BR'),
    numero,
    dados.cliente,
    dados.produto,
    dados.preco,
    dados.pagamento,
    dados.entrega,
    dados.enderecoOuHorario,
    'Pendente', '', '', '', '', ''
  ]);
  await wb.xlsx.writeFile(ARQ_PEDIDOS);
}

// soma/subtrai dias de uma data 'YYYY-MM-DD' sem depender do fuso do servidor
function somarDias(dataISO, dias) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ---------- lembretes de pedidos "A Prazo" (véspera + dia do vencimento) ----------
async function verificarLembretesAPrazo() {
  if (!sock || statusConexao !== 'conectado') return;
  if (!fs.existsSync(ARQ_PEDIDOS)) return;

  const config = lerJSON(ARQ_CONFIG, {});
  if (!config.chavePix) return; // sem chave Pix configurada, não dá pra montar o lembrete
  if (!estaDentroDoHorario(config)) return;

  const hoje = dataDeHoje();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARQ_PEDIDOS);
  const ws = wb.getWorksheet('Pedidos');
  if (!ws) return;

  let alterou = false;

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    if (!row.getCell(1).value) continue;
    if (row.getCell(9).value !== 'A Prazo') continue;

    const vencimento = row.getCell(11).value;
    if (!vencimento) continue;
    const comprovanteRecebido = row.getCell(12).value === 'Sim';
    if (comprovanteRecebido) continue;

    const numero = row.getCell(2).value;
    const produto = row.getCell(4).value || 'seu pedido';
    const preco = row.getCell(5).value;
    const jid = `${numero}@s.whatsapp.net`;
    const detalhe = `${produto}${preco ? ' — R$ ' + preco : ''}`;

    try {
      if (vencimento === hoje && row.getCell(14).value !== 'Sim') {
        await sock.sendMessage(jid, {
          text: `Oi! Passando pra lembrar que o pagamento do seu pedido (${detalhe}) vence hoje. Chave Pix: ${config.chavePix}. Assim que pagar, manda o comprovante aqui pra gente confirmar 🙂`
        });
        row.getCell(14).value = 'Sim';
        alterou = true;
      } else if (somarDias(vencimento, -1) === hoje && row.getCell(13).value !== 'Sim') {
        await sock.sendMessage(jid, {
          text: `Oi! Só lembrando que o pagamento do seu pedido (${detalhe}) vence amanhã. Chave Pix: ${config.chavePix}.`
        });
        row.getCell(13).value = 'Sim';
        alterou = true;
      }
    } catch (erro) {
      console.error(`Não foi possível enviar lembrete de pedido a prazo pro número ${numero}:`, erro.message);
    }
  }

  if (alterou) await wb.xlsx.writeFile(ARQ_PEDIDOS);
}

// ---------- notas fiscais (importação PDF/Excel/XML) ----------

let clienteIA = null;
function obterClienteIA() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!clienteIA) clienteIA = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return clienteIA;
}

// lê uma NF-e (XML padrão da Receita/Sefaz) direto na estrutura, sem precisar de IA
function parsearNotaXML(xmlTexto) {
  const parser = new XMLParser({ ignoreAttributes: false, isArray: (nome) => nome === 'det' });
  const doc = parser.parse(xmlTexto);
  const infNFe = doc?.nfeProc?.NFe?.infNFe || doc?.NFe?.infNFe;
  if (!infNFe) throw new Error('Esse XML não parece ser uma NF-e válida (tag infNFe não encontrada).');

  const fornecedor = infNFe.emit?.xNome || '';
  const dataEmissao = String(infNFe.ide?.dhEmi || infNFe.ide?.dEmi || '').slice(0, 10);
  const valorTotal = Number(infNFe.total?.ICMSTot?.vNF || 0);
  const itens = (infNFe.det || []).map((item) => {
    const prod = item.prod || {};
    return {
      descricao: prod.xProd || '',
      quantidade: Number(prod.qCom || 1),
      valorUnitario: Number(prod.vUnCom || 0),
      valorTotal: Number(prod.vProd || 0)
    };
  });
  return { fornecedor, data: dataEmissao, valorTotal, itens };
}

// planilhas de nota não têm formato fixo — converte em texto simples (linha por linha) pra IA ler
async function excelParaTexto(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  let texto = '';
  wb.eachSheet((ws) => {
    texto += `\n--- Planilha: ${ws.name} ---\n`;
    ws.eachRow((row) => {
      texto += row.values.slice(1).map((v) => (v == null ? '' : String(v))).join(' | ') + '\n';
    });
  });
  return texto;
}

const FERRAMENTA_EXTRAIR_NOTA = {
  name: 'registrar_nota',
  description: 'Registra os dados extraídos da nota fiscal/comprovante de compra.',
  input_schema: {
    type: 'object',
    properties: {
      fornecedor: { type: 'string', description: 'Nome do fornecedor/emitente da nota' },
      data: { type: 'string', description: 'Data de emissão da nota, formato YYYY-MM-DD' },
      valorTotal: { type: 'number', description: 'Valor total da nota' },
      itens: {
        type: 'array',
        description: 'Cada produto/linha comprado na nota',
        items: {
          type: 'object',
          properties: {
            descricao: { type: 'string' },
            quantidade: { type: 'number' },
            valorUnitario: { type: 'number' },
            valorTotal: { type: 'number' }
          },
          required: ['descricao', 'valorTotal']
        }
      }
    },
    required: ['fornecedor', 'valorTotal', 'itens']
  }
};

// pdfBase64 (nota em PDF) OU texto (nota em Excel, já convertida) — nunca os dois juntos
async function extrairNotaComIA({ pdfBase64, texto }) {
  const client = obterClienteIA();
  if (!client) throw new Error('Extração automática exige a chave ANTHROPIC_API_KEY configurada no servidor.');

  const conteudo = pdfBase64
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: 'Extraia os dados dessa nota fiscal/comprovante de compra.' }
      ]
    : [{ type: 'text', text: `Extraia os dados da nota fiscal a partir dessa planilha (convertida em texto):\n\n${texto}` }];

  const resposta = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: conteudo }],
    tools: [FERRAMENTA_EXTRAIR_NOTA],
    tool_choice: { type: 'tool', name: 'registrar_nota' }
  });

  const blocoFerramenta = resposta.content.find((b) => b.type === 'tool_use');
  if (!blocoFerramenta) throw new Error('A IA não conseguiu extrair os dados dessa nota.');
  return blocoFerramenta.input;
}

// ---------- financeiro (receita de pedidos x custos de notas) ----------

function parsePrecoBR(valor) {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  let limpo = String(valor).replace(/[^\d,.-]/g, '');
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}

// pedidos.xlsx guarda a data como "DD/MM/AAAA, HH:MM:SS" (toLocaleString('pt-BR'))
function parseDataPedido(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function calcularFinanceiro(inicio, fim) {
  let receita = 0;
  let numPedidos = 0;

  if (fs.existsSync(ARQ_PEDIDOS)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(ARQ_PEDIDOS);
    const ws = wb.getWorksheet('Pedidos');
    if (ws) {
      ws.eachRow((row, numeroLinha) => {
        if (numeroLinha === 1) return;
        if (!row.getCell(1).value) return;
        const status = row.getCell(9).value || 'Pendente';
        if (status !== 'Confirmado' && status !== 'A Prazo') return;
        const dataPedido = parseDataPedido(row.getCell(1).value);
        if (inicio && (!dataPedido || dataPedido < inicio)) return;
        if (fim && (!dataPedido || dataPedido > fim)) return;
        receita += parsePrecoBR(row.getCell(5).value);
        numPedidos++;
      });
    }
  }

  const notas = lerJSON(ARQ_NOTAS, []);
  let custos = 0;
  let numNotas = 0;
  for (const nota of notas) {
    if (inicio && (!nota.data || nota.data < inicio)) continue;
    if (fim && (!nota.data || nota.data > fim)) continue;
    custos += Number(nota.valorTotal) || 0;
    numNotas++;
  }

  return { receita, custos, lucro: receita - custos, numPedidos, numNotas };
}

// ---------- WhatsApp ----------

async function iniciarWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(PASTA_AUTH);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      ultimoQR = await QRCode.toDataURL(qr);
      statusConexao = 'aguardando_qr';
    }

    if (connection === 'open') {
      statusConexao = 'conectado';
      ultimoQR = null;
      numeroConectado = sock.user?.id?.split(':')[0] || null;
    }

    if (connection === 'close') {
      statusConexao = 'desconectado';
      numeroConectado = null;
      const motivo = lastDisconnect?.error?.output?.statusCode;
      if (motivo !== DisconnectReason.loggedOut) {
        iniciarWhatsApp();
      }
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;

      const texto = extrairTexto(msg);
      if (!texto) continue;

      // encadeia na fila em vez de processar na hora — garante que a mensagem
      // anterior (mesmo de outro contato) termine antes desta começar
      filaProcessamento = filaProcessamento.then(async () => {
        const config = lerJSON(ARQ_CONFIG, {});
        if (!config.respostaAutomaticaAtiva) return;
        const mensagens = lerJSON(ARQ_MENSAGENS, []);
        await responderMensagem(jid, texto, msg.pushName, config, mensagens, msg);
      }).catch((erro) => {
        console.error('Erro ao processar mensagem na fila:', erro.message);
      });
    }
  });
}

async function enviarComDigitando(jid, texto, config) {
  if (config.humanizado) {
    await sock.sendPresenceUpdate('composing', jid);
    const atraso = Math.min(4000, 800 + texto.length * 25);
    await new Promise((r) => setTimeout(r, atraso));
    await sock.sendPresenceUpdate('paused', jid);
  }
  await sock.sendMessage(jid, { text: texto });
}

// marca a conversa como NÃO LIDA no WhatsApp de verdade (não só a nota do painel),
// pra chamar a atenção do vendedor de que precisa assumir esse cliente
async function marcarComoNaoLida(jid, msg) {
  if (!sock || !msg) return;
  try {
    await sock.chatModify(
      { markRead: false, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] },
      jid
    );
  } catch (erro) {
    console.error('Não foi possível marcar a conversa como não lida:', erro.message);
  }
}

// contatos que chegam via @lid (identificador anônimo que o WhatsApp usa às vezes em vez
// do número de telefone) podem ter um @lid diferente em mensagens diferentes da MESMA
// pessoa — se a gente guardar o estado (saudadosHoje/pausados) por esse @lid, o bot "esquece"
// que já falou com o contato hoje e manda a saudação/link de novo em toda mensagem.
// remoteJidAlt é o JID de telefone estável que o Baileys manda junto nesses casos.
function chaveEstavel(chaveMensagem) {
  if (!chaveMensagem) return null;
  if (chaveMensagem.remoteJid && chaveMensagem.remoteJid.endsWith('@lid') && chaveMensagem.remoteJidAlt) {
    return chaveMensagem.remoteJidAlt;
  }
  return chaveMensagem.remoteJid;
}

async function responderMensagem(jid, texto, pushName, config, mensagens, msgOriginal) {
  const chave = chaveEstavel(msgOriginal && msgOriginal.key) || jid;
  const numero = chave.split('@')[0];

  if (pausadoHoje(chave)) {
    // conversa já escalada para atendimento manual: só registra, não responde
    registrarConversa(numero, texto, null, true, 'pausado');
    return;
  }

  const primeiraHoje = !jaFoiSaudadoHoje(chave);
  const dentroHorario = estaDentroDoHorario(config);
  const encontrada = buscarRespostaRapida(texto, mensagens);
  // se não bateu nenhuma palavra-chave, vai cair no Fallback Fora do Horário (que já
  // avisa do horário); se bateu mas a mensagem tem uma variante própria pra fora do
  // horário, ela também já cobre o aviso — nos dois casos não precisa da Ausência junto
  const respostaJaCobreHorario = !dentroHorario && (!encontrada || Boolean(encontrada.respostaForaHorario));

  if (primeiraHoje) {
    marcarSaudadoHoje(chave);
    const tipoSaudacao = dentroHorario ? 'Saudação' : 'Saudação Fora do Horário';
    const msgSaudacao = buscarPorTipo(mensagens, tipoSaudacao);
    if (msgSaudacao) {
      const resposta = substituirPlaceholders(msgSaudacao.resposta, pushName, config);
      await enviarComDigitando(jid, resposta, config);
      registrarConversa(numero, texto, resposta, false, tipoSaudacao);
    }
  } else if (!dentroHorario && !jaEnviouAusenciaHoje(chave) && !ehSaudacao(texto) && !respostaJaCobreHorario) {
    marcarAusenciaHoje(chave);
    const msgAusencia = buscarPorTipo(mensagens, 'Ausência');
    if (msgAusencia) {
      const resposta = substituirPlaceholders(msgAusencia.resposta, pushName, config);
      await enviarComDigitando(jid, resposta, config);
      registrarConversa(numero, texto, resposta, false, 'Ausência');
    }
  }

  if (!encontrada) {
    if (ehSaudacao(texto)) {
      // só cumprimento, sem pergunta de verdade junto — não escala pro Fallback
      registrarConversa(numero, texto, null, false, 'saudacao-simples');
      return;
    }
    if (primeiraHoje) {
      // 1ª mensagem do dia sem bater com nada: a saudação já foi enviada acima,
      // não manda Fallback junto — dá chance da pessoa explicar o que quer antes de escalar
      registrarConversa(numero, texto, null, false, 'sem-match-primeira-msg');
      return;
    }
    marcarPausado(chave);
    const tipoFallback = dentroHorario ? 'Fallback' : 'Fallback Fora do Horário';
    const msgFallback = buscarPorTipo(mensagens, tipoFallback);
    const resposta = msgFallback ? substituirPlaceholders(msgFallback.resposta, pushName, config) : null;
    if (resposta) await enviarComDigitando(jid, resposta, config);
    await marcarComoNaoLida(jid, msgOriginal);
    registrarConversa(numero, texto, resposta, true, tipoFallback);
    return;
  }

  const dadosPedido = encontrada.salvarPedido ? extrairDadosPedido(texto) : null;
  const textoBase = (!dentroHorario && encontrada.respostaForaHorario) ? encontrada.respostaForaHorario : encontrada.resposta;
  const resposta = substituirPlaceholders(textoBase, pushName, config, dadosPedido);
  await enviarComDigitando(jid, resposta, config);
  registrarConversa(numero, texto, resposta, false, 'Resposta Rápida');

  if (encontrada.salvarPedido) {
    try {
      await salvarPedidoPlanilha(numero, dadosPedido);
    } catch (erro) {
      console.error('Não foi possível salvar o pedido na planilha:', erro.message);
    }
  }

  if (encontrada.escalar) {
    // ex: depois da confirmação de pedido, o vendedor assume — bot fica em silêncio o resto do dia
    marcarPausado(chave);
    await marcarComoNaoLida(jid, msgOriginal);
  }
}

// ---------- servidor web / API do painel ----------

const PAINEL_USUARIO = 'clicksim';
const PAINEL_SENHA = 'clicksim2026'; // trocar aqui pra mudar a senha do painel

function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization;
  if (cabecalho && cabecalho.startsWith('Basic ')) {
    const [usuario, senha] = Buffer.from(cabecalho.slice(6), 'base64').toString().split(':');
    if (usuario === PAINEL_USUARIO && senha === PAINEL_SENHA) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Painel Click Sim"');
  res.status(401).send('Acesso restrito.');
}

const app = express();
// limite padrão do Express é 100kb — as fotos dos produtos (em base64) somadas facilmente
// passam disso, causando "PayloadTooLargeError" ao salvar no painel sem nenhum aviso claro
app.use(express.json({ limit: '50mb' }));

// ---------- catálogo público (SISTEMA) — sem login, é o site que qualquer cliente visita ----------
// Fica antes do exigirLogin de propósito: o catálogo publicado precisa carregar sem senha.
// A gravação (POST /api/perfumes) continua abaixo do exigirLogin, só o painel pode salvar.
// CORS liberado só nessa rota: o catálogo publicado vive noutra origem (GitHub Pages) e precisa
// buscar os dados daqui via fetch — sem isso o navegador bloqueia a resposta.
app.get('/api/perfumes', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json(lerJSON(ARQ_PERFUMES, []));
});
app.get('/api/numero-whatsapp', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const config = lerJSON(ARQ_CONFIG, {});
  res.json({ numeroWhatsapp: config.numeroWhatsapp || '' });
});
app.use('/SISTEMA', express.static(PASTA_SISTEMA));
app.use('/EDICAO/imagens', express.static(PASTA_IMAGENS_CATALOGO));
app.use('/imagens-produtos', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
}, express.static(PASTA_IMAGENS_UPLOAD));

app.use(exigirLogin);
app.use(express.static(path.join(__dirname, 'public')));

// Recebe uma foto em base64 (do painel) e salva como arquivo de verdade, em vez de deixar
// embutida dentro de perfumes.json — evita que o arquivo de produtos fique gigante e lento
// de salvar conforme o catálogo cresce (era a causa do PayloadTooLargeError de antes).
app.post('/api/upload-imagem', (req, res) => {
  const { dataUrl } = req.body;
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return res.status(400).json({ erro: 'imagem inválida' });
  const [, extensao, base64] = match;
  const nomeArquivo = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao === 'jpeg' ? 'jpg' : extensao}`;
  fs.writeFileSync(path.join(PASTA_IMAGENS_UPLOAD, nomeArquivo), Buffer.from(base64, 'base64'));
  res.json({ arquivo: nomeArquivo, url: `https://167-99-150-99.sslip.io/imagens-produtos/${nomeArquivo}` });
});

app.post('/api/perfumes', (req, res) => {
  const lista = req.body;
  if (!Array.isArray(lista)) return res.status(400).json({ erro: 'esperado uma lista de produtos' });
  salvarJSON(ARQ_PERFUMES, lista);
  res.json({ ok: true });
});

app.get('/api/status', (req, res) => {
  res.json({ status: statusConexao, qr: ultimoQR, numero: numeroConectado });
});

app.get('/api/mensagens', (req, res) => {
  res.json(lerJSON(ARQ_MENSAGENS, []));
});

app.post('/api/mensagens', (req, res) => {
  const { tipo, titulo, ativa, palavras_chave, resposta, notaInterna } = req.body;
  if (!tipo || !resposta) {
    return res.status(400).json({ erro: 'tipo e resposta são obrigatórios' });
  }

  const mensagens = lerJSON(ARQ_MENSAGENS, []);

  if (TIPOS_SISTEMA.includes(tipo) && mensagens.some((m) => m.tipo === tipo)) {
    return res.status(400).json({ erro: `Já existe uma mensagem do tipo "${tipo}" — edite a existente em vez de criar outra.` });
  }

  const nova = {
    id: Date.now().toString(),
    tipo,
    titulo: titulo || '',
    ativa: ativa !== false,
    palavras_chave: Array.isArray(palavras_chave)
      ? palavras_chave
      : String(palavras_chave || '').split(',').map((p) => p.trim()).filter(Boolean),
    resposta,
    ...(notaInterna ? { notaInterna } : {})
  };
  mensagens.push(nova);
  salvarJSON(ARQ_MENSAGENS, mensagens);
  res.json(nova);
});

app.put('/api/mensagens/:id', (req, res) => {
  const mensagens = lerJSON(ARQ_MENSAGENS, []);
  const idx = mensagens.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'não encontrada' });

  const { tipo, titulo, ativa, palavras_chave, resposta, notaInterna } = req.body;

  if (
    tipo &&
    tipo !== mensagens[idx].tipo &&
    TIPOS_SISTEMA.includes(tipo) &&
    mensagens.some((m, i) => i !== idx && m.tipo === tipo)
  ) {
    return res.status(400).json({ erro: `Já existe uma mensagem do tipo "${tipo}".` });
  }

  if (tipo) mensagens[idx].tipo = tipo;
  if (titulo !== undefined) mensagens[idx].titulo = titulo;
  if (ativa !== undefined) mensagens[idx].ativa = ativa;
  if (palavras_chave !== undefined) {
    mensagens[idx].palavras_chave = Array.isArray(palavras_chave)
      ? palavras_chave
      : String(palavras_chave || '').split(',').map((p) => p.trim()).filter(Boolean);
  }
  if (resposta) mensagens[idx].resposta = resposta;
  if (notaInterna !== undefined) mensagens[idx].notaInterna = notaInterna;

  salvarJSON(ARQ_MENSAGENS, mensagens);
  res.json(mensagens[idx]);
});

app.delete('/api/mensagens/:id', (req, res) => {
  const mensagens = lerJSON(ARQ_MENSAGENS, []);
  const alvo = mensagens.find((m) => m.id === req.params.id);

  if (alvo && TIPOS_SISTEMA.includes(alvo.tipo)) {
    return res.status(400).json({ erro: `Não é possível excluir a mensagem de "${alvo.tipo}" — ela é usada automaticamente pelo bot.` });
  }

  const filtradas = mensagens.filter((m) => m.id !== req.params.id);
  salvarJSON(ARQ_MENSAGENS, filtradas);
  res.json({ ok: true });
});

app.get('/api/config', (req, res) => {
  res.json(lerJSON(ARQ_CONFIG, {}));
});

app.post('/api/config', (req, res) => {
  const atual = lerJSON(ARQ_CONFIG, {});
  const novo = { ...atual, ...req.body };
  salvarJSON(ARQ_CONFIG, novo);
  res.json(novo);
});

app.get('/api/conversas', (req, res) => {
  res.json(lerJSON(ARQ_CONVERSAS, []));
});

app.get('/api/pedidos', async (req, res) => {
  if (!fs.existsSync(ARQ_PEDIDOS)) return res.json([]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARQ_PEDIDOS);
  const ws = wb.getWorksheet('Pedidos');
  if (!ws) return res.json([]);
  const pedidos = [];
  ws.eachRow((row, numeroLinha) => {
    if (numeroLinha === 1) return; // cabeçalho
    if (!row.getCell(1).value) return; // linha vazia
    const valores = row.values.slice(1); // ExcelJS usa índice 1-based e deixa [0] vazio
    pedidos.push({
      linha: numeroLinha,
      data: valores[0] || '',
      numero: valores[1] || '',
      cliente: valores[2] || '',
      produto: valores[3] || '',
      preco: valores[4] || '',
      pagamento: valores[5] || '',
      entrega: valores[6] || '',
      enderecoOuHorario: valores[7] || '',
      status: valores[8] || 'Pendente',
      formaPagamentoConfirmada: valores[9] || '',
      dataVencimento: valores[10] || '',
      comprovanteRecebido: valores[11] || ''
    });
  });
  res.json(pedidos.reverse());
});

app.post('/api/pedidos/:linha/status', async (req, res) => {
  const linha = Number(req.params.linha);
  const { status, formaPagamento, dataVencimento } = req.body;
  if (!Number.isInteger(linha) || linha < 2) return res.status(400).json({ erro: 'Linha inválida' });
  if (!STATUS_PEDIDO_VALIDOS.includes(status)) return res.status(400).json({ erro: 'Status inválido' });
  if (status === 'A Prazo' && !dataVencimento) return res.status(400).json({ erro: 'Informe a data de vencimento' });
  if (!fs.existsSync(ARQ_PEDIDOS)) return res.status(404).json({ erro: 'Nenhum pedido registrado ainda' });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARQ_PEDIDOS);
  const ws = wb.getWorksheet('Pedidos');
  const row = ws && ws.getRow(linha);
  if (!row || !row.getCell(1).value) return res.status(404).json({ erro: 'Pedido não encontrado' });

  row.getCell(9).value = status;
  row.getCell(10).value = formaPagamento || '';
  if (status === 'A Prazo') {
    row.getCell(11).value = dataVencimento;
    row.getCell(12).value = 'Não';
    row.getCell(13).value = '';
    row.getCell(14).value = '';
  } else if (status === 'Pendente') {
    // "reabrir": limpa os campos de confirmação/vencimento/lembrete
    row.getCell(11).value = '';
    row.getCell(12).value = '';
    row.getCell(13).value = '';
    row.getCell(14).value = '';
  }
  row.commit();
  await wb.xlsx.writeFile(ARQ_PEDIDOS);
  res.json({ ok: true });
});

app.post('/api/pedidos/:linha/comprovante', async (req, res) => {
  const linha = Number(req.params.linha);
  if (!Number.isInteger(linha) || linha < 2) return res.status(400).json({ erro: 'Linha inválida' });
  if (!fs.existsSync(ARQ_PEDIDOS)) return res.status(404).json({ erro: 'Nenhum pedido registrado ainda' });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARQ_PEDIDOS);
  const ws = wb.getWorksheet('Pedidos');
  const row = ws && ws.getRow(linha);
  if (!row || !row.getCell(1).value) return res.status(404).json({ erro: 'Pedido não encontrado' });

  row.getCell(12).value = 'Sim';
  row.commit();
  await wb.xlsx.writeFile(ARQ_PEDIDOS);
  res.json({ ok: true });
});

app.post('/api/notas/extrair', async (req, res) => {
  const { tipo, dataBase64 } = req.body;
  try {
    let extraido;
    if (tipo === 'xml') {
      extraido = parsearNotaXML(Buffer.from(dataBase64, 'base64').toString('utf-8'));
    } else if (tipo === 'excel') {
      const texto = await excelParaTexto(Buffer.from(dataBase64, 'base64'));
      extraido = await extrairNotaComIA({ texto });
    } else if (tipo === 'pdf') {
      extraido = await extrairNotaComIA({ pdfBase64: dataBase64 });
    } else {
      return res.status(400).json({ erro: 'Tipo de arquivo não suportado. Use PDF, Excel ou XML.' });
    }
    res.json(extraido);
  } catch (erro) {
    console.error('Erro ao extrair nota fiscal:', erro.message);
    res.status(400).json({ erro: erro.message });
  }
});

app.get('/api/notas', (req, res) => {
  res.json(lerJSON(ARQ_NOTAS, []));
});

app.post('/api/notas', (req, res) => {
  const { fornecedor, data, valorTotal, nomeArquivoOriginal, itens } = req.body;
  if (!fornecedor || !Array.isArray(itens)) return res.status(400).json({ erro: 'Dados incompletos' });

  const notas = lerJSON(ARQ_NOTAS, []);
  const nota = {
    id: Date.now().toString(),
    criadoEm: new Date().toISOString(),
    fornecedor,
    data: data || '',
    valorTotal: Number(valorTotal) || 0,
    nomeArquivoOriginal: nomeArquivoOriginal || '',
    itens
  };
  notas.unshift(nota);
  salvarJSON(ARQ_NOTAS, notas);

  // atualiza o custo dos perfumes vinculados (por nome+marca — o catálogo não tem id estável)
  const perfumes = lerJSON(ARQ_PERFUMES, []);
  let alterouPerfumes = false;
  for (const item of itens) {
    if (!item.perfumeNome) continue;
    const p = perfumes.find((x) => x.nome === item.perfumeNome && x.marca === item.perfumeMarca);
    if (p) {
      p.custoUnitario = Number(item.valorUnitario) || p.custoUnitario || 0;
      alterouPerfumes = true;
    }
  }
  if (alterouPerfumes) salvarJSON(ARQ_PERFUMES, perfumes);

  res.json({ ok: true, id: nota.id });
});

app.delete('/api/notas/:id', (req, res) => {
  const notas = lerJSON(ARQ_NOTAS, []);
  const filtradas = notas.filter((n) => n.id !== req.params.id);
  salvarJSON(ARQ_NOTAS, filtradas);
  res.json({ ok: true });
});

app.get('/api/financeiro', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    res.json(await calcularFinanceiro(inicio, fim));
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

app.post('/api/reconectar', async (req, res) => {
  try {
    if (sock) sock.end();
    fs.rmSync(PASTA_AUTH, { recursive: true, force: true });
    statusConexao = 'desconectado';
    ultimoQR = null;
    numeroConectado = null;
    await iniciarWhatsApp();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/encerrar', (req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 300);
});

if (require.main === module) {
  app.listen(PORTA, () => {
    console.log(`Painel disponível em http://localhost:${PORTA}`);
    fs.writeFileSync(path.join(__dirname, 'pid.txt'), String(process.pid), 'utf-8');
  });

  iniciarWhatsApp();

  setInterval(() => {
    verificarLembretesAPrazo().catch((erro) => console.error('Erro ao verificar lembretes de pedidos a prazo:', erro.message));
  }, 60 * 60 * 1000);
} else {
  // exportado só pra permitir testar as funções puras isoladamente (ver test-logica.js)
  module.exports = { buscarRespostaRapida, substituirPlaceholders, nomeValido, estaDentroDoHorario, normalizar, extrairDadosPedido, salvarPedidoPlanilha };
}

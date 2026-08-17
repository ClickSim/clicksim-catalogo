const elBadge = document.getElementById('status-badge');
const elSecaoQR = document.getElementById('secao-qr');
const elQrImg = document.getElementById('qr-img');
const elSecaoConectado = document.getElementById('secao-conectado');
const elNumeroAtivo = document.getElementById('numero-ativo');

const TIPOS_SISTEMA = ['Saudação', 'Saudação Fora do Horário', 'Ausência', 'Fallback', 'Fallback Fora do Horário'];

const rotulosStatus = {
  desconectado: 'Desconectado',
  aguardando_qr: 'Aguardando leitura do QR',
  conectado: 'Conectado'
};

let mensagensCache = [];

async function atualizarStatus() {
  const r = await fetch('/api/status');
  const dados = await r.json();

  elBadge.textContent = rotulosStatus[dados.status] || dados.status;
  elBadge.className = 'badge ' + dados.status;

  elSecaoQR.hidden = dados.status !== 'aguardando_qr';
  if (dados.qr) elQrImg.src = dados.qr;

  elSecaoConectado.hidden = dados.status !== 'conectado';
  if (dados.numero) elNumeroAtivo.textContent = dados.numero;
}

async function carregarConfig() {
  const r = await fetch('/api/config');
  const cfg = await r.json();
  document.getElementById('cfg-nome-atendente').value = cfg.nomeAtendente || '';
  document.getElementById('cfg-link-catalogo').value = cfg.linkCatalogo || '';
  document.getElementById('cfg-horario-abertura').value = cfg.horarioAbertura || '';
  document.getElementById('cfg-horario-fechamento').value = cfg.horarioFechamento || '';
  document.getElementById('cfg-ativo').checked = !!cfg.respostaAutomaticaAtiva;
  document.getElementById('cfg-humanizado').checked = !!cfg.humanizado;
}

// diferente dos outros campos de configuração, esse toggle é um controle "ao vivo" (fica lá
// em cima, longe do botão "Salvar configurações") — precisa salvar sozinho assim que muda,
// senão a pessoa acha que já desligou o bot e ele continua respondendo
document.getElementById('cfg-ativo').addEventListener('change', async (e) => {
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respostaAutomaticaAtiva: e.target.checked })
  });
});

document.getElementById('btn-salvar-config').addEventListener('click', async () => {
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nomeAtendente: document.getElementById('cfg-nome-atendente').value,
      linkCatalogo: document.getElementById('cfg-link-catalogo').value,
      horarioAbertura: document.getElementById('cfg-horario-abertura').value,
      horarioFechamento: document.getElementById('cfg-horario-fechamento').value,
      respostaAutomaticaAtiva: document.getElementById('cfg-ativo').checked,
      humanizado: document.getElementById('cfg-humanizado').checked
    })
  });
  alert('Configurações salvas!');
});

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : String(texto);
  return div.innerHTML;
}

function atualizarCampoPalavras() {
  const tipo = document.getElementById('nova-tipo').value;
  document.getElementById('campo-nova-palavras').hidden = tipo !== 'Resposta Rápida';
}
document.getElementById('nova-tipo').addEventListener('change', atualizarCampoPalavras);
atualizarCampoPalavras();

function limparFormulario() {
  document.getElementById('edicao-id').value = '';
  document.getElementById('nova-tipo').value = 'Resposta Rápida';
  document.getElementById('nova-titulo').value = '';
  document.getElementById('nova-palavras').value = '';
  document.getElementById('nova-resposta').value = '';
  document.getElementById('nova-nota').value = '';
  document.getElementById('nova-ativa').checked = true;
  document.getElementById('titulo-form').textContent = 'Adicionar mensagem';
  document.getElementById('btn-add-pergunta').textContent = '✓ Salvar';
  atualizarCampoPalavras();
}

function iniciarEdicao(id) {
  const m = mensagensCache.find((x) => x.id === id);
  if (!m) return;
  document.getElementById('edicao-id').value = m.id;
  document.getElementById('nova-tipo').value = m.tipo;
  document.getElementById('nova-titulo').value = m.titulo || '';
  document.getElementById('nova-palavras').value = (m.palavras_chave || []).join(', ');
  document.getElementById('nova-resposta').value = m.resposta || '';
  document.getElementById('nova-nota').value = m.notaInterna || '';
  document.getElementById('nova-ativa').checked = m.ativa !== false;
  document.getElementById('titulo-form').textContent = 'Editando: ' + (m.titulo || m.tipo);
  document.getElementById('btn-add-pergunta').textContent = 'Salvar alterações';
  atualizarCampoPalavras();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function carregarMensagens() {
  const r = await fetch('/api/mensagens');
  mensagensCache = await r.json();
  const container = document.getElementById('lista-perguntas');
  container.innerHTML = '';

  if (mensagensCache.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhuma mensagem cadastrada ainda.</p>';
    return;
  }

  for (const m of mensagensCache) {
    const ehSistema = TIPOS_SISTEMA.includes(m.tipo);
    const div = document.createElement('div');
    div.className = 'item-pergunta';
    div.innerHTML = `
      <div class="chaves">
        <span class="tag-tipo">${escaparHTML(m.tipo)}</span>
        ${m.ativa === false ? '<span class="tag-inativa">Desativada</span>' : ''}
      </div>
      <div class="titulo-mensagem">${escaparHTML(m.titulo || '')}</div>
      ${m.tipo === 'Resposta Rápida' && (m.palavras_chave || []).length
        ? `<div class="chaves-lista">${escaparHTML(m.palavras_chave.join(', '))}</div>`
        : ''}
      <div class="resposta-texto">${escaparHTML(m.resposta).replace(/\n/g, '<br>')}</div>
      ${m.notaInterna ? `<div class="nota-interna">📌 ${escaparHTML(m.notaInterna)}</div>` : ''}
      <button class="btn btn-secundario btn-editar" data-id="${m.id}">Editar</button>
      ${ehSistema ? '' : `<button class="btn btn-perigo btn-excluir" data-id="${m.id}">Excluir</button>`}
    `;
    container.appendChild(div);
  }

  container.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => iniciarEdicao(btn.dataset.id));
  });

  container.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir esta mensagem?')) return;
      const resp = await fetch('/api/mensagens/' + btn.dataset.id, { method: 'DELETE' });
      if (!resp.ok) {
        const erro = await resp.json();
        alert(erro.erro || 'Não foi possível excluir.');
        return;
      }
      carregarMensagens();
    });
  });
}

document.getElementById('btn-add-pergunta').addEventListener('click', async () => {
  const id = document.getElementById('edicao-id').value;
  const tipo = document.getElementById('nova-tipo').value;
  const titulo = document.getElementById('nova-titulo').value.trim();
  const palavras = document.getElementById('nova-palavras').value.trim();
  const resposta = document.getElementById('nova-resposta').value.trim();
  const notaInterna = document.getElementById('nova-nota').value.trim();
  const ativa = document.getElementById('nova-ativa').checked;

  if (!resposta) {
    alert('Preencha a resposta.');
    return;
  }
  if (tipo === 'Resposta Rápida' && !palavras) {
    alert('Preencha as palavras-chave (obrigatório para o tipo Resposta Rápida).');
    return;
  }

  const payload = { tipo, titulo, ativa, palavras_chave: palavras, resposta, notaInterna };
  const resp = await fetch(id ? '/api/mensagens/' + id : '/api/mensagens', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const erro = await resp.json();
    alert(erro.erro || 'Não foi possível salvar.');
    return;
  }

  limparFormulario();
  carregarMensagens();
});

document.getElementById('btn-limpar-form').addEventListener('click', limparFormulario);

async function carregarConversas() {
  const r = await fetch('/api/conversas');
  const conversas = await r.json();
  const container = document.getElementById('lista-conversas');

  if (conversas.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhuma conversa ainda.</p>';
    return;
  }

  container.innerHTML = conversas
    .slice(0, 30)
    .map((c) => {
      const marcador = c.escalado ? '🔴 ' : '';
      const linhaBot = c.resposta
        ? `<div class="msg-bot">Bot${c.tipo ? ' (' + escaparHTML(c.tipo) + ')' : ''}: ${escaparHTML(c.resposta)}</div>`
        : `<div class="msg-bot msg-pausada">— aguardando atendente —</div>`;
      return `
      <div class="conversa-item">
        <div class="numero">${marcador}${escaparHTML(c.numero)}</div>
        <div class="msg-cliente">Cliente: ${escaparHTML(c.mensagem)}</div>
        ${linhaBot}
      </div>`;
    })
    .join('');
}

document.getElementById('btn-reconectar').addEventListener('click', async () => {
  if (!confirm('Isso vai desconectar o número atual. Deseja continuar?')) return;
  await fetch('/api/reconectar', { method: 'POST' });
  atualizarStatus();
});

document.getElementById('btn-encerrar').addEventListener('click', async () => {
  if (!confirm('Isso vai desligar o atendente. Deseja continuar?')) return;
  await fetch('/api/encerrar', { method: 'POST' });
  document.body.innerHTML = '<div class="app"><h1>Atendente desligado.</h1><p>Você pode fechar esta aba.</p></div>';
});

atualizarStatus();
carregarConfig();
carregarMensagens();
carregarConversas();

setInterval(atualizarStatus, 2500);
setInterval(carregarConversas, 5000);

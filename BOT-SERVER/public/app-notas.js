let perfumesCatalogoNotas = [];
let itensRevisaoNota = [];

function detectarTipoArquivo(nomeArquivo) {
  const ext = nomeArquivo.toLowerCase().split('.').pop();
  if (ext === 'xml') return 'xml';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  return null;
}

function lerArquivoComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result.split(',')[1]);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

async function carregarPerfumesParaNotas() {
  try {
    const resp = await fetch('/api/perfumes');
    perfumesCatalogoNotas = await resp.json();
  } catch {
    perfumesCatalogoNotas = [];
  }
}

document.getElementById('btnExtrairNota').addEventListener('click', async () => {
  const arquivoInput = document.getElementById('notaArquivo');
  const arquivo = arquivoInput.files[0];
  const avisoEl = document.getElementById('notaExtraindoAviso');
  const erroEl = document.getElementById('notaErro');
  erroEl.hidden = true;

  if (!arquivo) {
    erroEl.textContent = 'Escolha um arquivo primeiro (PDF, Excel ou XML).';
    erroEl.hidden = false;
    return;
  }

  const tipo = detectarTipoArquivo(arquivo.name);
  if (!tipo) {
    erroEl.textContent = 'Formato não reconhecido. Use .pdf, .xlsx, .xls ou .xml.';
    erroEl.hidden = false;
    return;
  }

  avisoEl.hidden = false;
  document.getElementById('secaoRevisaoNota').hidden = true;

  try {
    const dataBase64 = await lerArquivoComoBase64(arquivo);
    const resp = await fetch('/api/notas/extrair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, dataBase64 })
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Não foi possível extrair os dados da nota.');

    await carregarPerfumesParaNotas();
    document.getElementById('notaFornecedor').value = dados.fornecedor || '';
    document.getElementById('notaData').value = dados.data || '';
    document.getElementById('notaValorTotal').value = dados.valorTotal || '';
    itensRevisaoNota = (dados.itens || []).map((item) => ({ ...item, perfumeSelecionado: '' }));
    renderizarItensRevisaoNota();
    document.getElementById('secaoRevisaoNota').hidden = false;
  } catch (erro) {
    erroEl.textContent = erro.message;
    erroEl.hidden = false;
  } finally {
    avisoEl.hidden = true;
  }
});

function renderizarItensRevisaoNota() {
  const container = document.getElementById('notaItens');
  const opcoesPerfumes = perfumesCatalogoNotas
    .map((p, i) => `<option value="${i}">${escaparHTML(p.marca)} - ${escaparHTML(p.nome)}</option>`)
    .join('');

  container.innerHTML = itensRevisaoNota.map((item, indice) => `
    <div class="item-nota-revisao" data-indice="${indice}">
      <div class="form-linha">
        <label>Descrição
          <input type="text" class="item-descricao" value="${escaparHTML(item.descricao || '')}">
        </label>
        <label>Qtd.
          <input type="number" class="item-quantidade" step="0.01" value="${item.quantidade ?? 1}">
        </label>
        <label>Valor unit.
          <input type="number" class="item-valor-unitario" step="0.01" value="${item.valorUnitario ?? ''}">
        </label>
        <label>Valor total
          <input type="number" class="item-valor-total" step="0.01" value="${item.valorTotal ?? ''}">
        </label>
      </div>
      <label>Vincular ao perfume do catálogo (atualiza o custo dele)
        <select class="item-perfume-select">
          <option value="">Não vincular</option>
          ${opcoesPerfumes}
        </select>
      </label>
    </div>
  `).join('');
}

document.getElementById('btnCancelarNota').addEventListener('click', () => {
  document.getElementById('secaoRevisaoNota').hidden = true;
  document.getElementById('notaArquivo').value = '';
  itensRevisaoNota = [];
});

document.getElementById('btnSalvarNota').addEventListener('click', async () => {
  const linhas = document.querySelectorAll('#notaItens .item-nota-revisao');
  const itens = Array.from(linhas).map((linha) => {
    const selecaoIndice = linha.querySelector('.item-perfume-select').value;
    const perfume = selecaoIndice !== '' ? perfumesCatalogoNotas[Number(selecaoIndice)] : null;
    return {
      descricao: linha.querySelector('.item-descricao').value,
      quantidade: Number(linha.querySelector('.item-quantidade').value) || 0,
      valorUnitario: Number(linha.querySelector('.item-valor-unitario').value) || 0,
      valorTotal: Number(linha.querySelector('.item-valor-total').value) || 0,
      perfumeNome: perfume ? perfume.nome : null,
      perfumeMarca: perfume ? perfume.marca : null
    };
  });

  const resp = await fetch('/api/notas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fornecedor: document.getElementById('notaFornecedor').value,
      data: document.getElementById('notaData').value,
      valorTotal: Number(document.getElementById('notaValorTotal').value) || 0,
      nomeArquivoOriginal: document.getElementById('notaArquivo').files[0]?.name || '',
      itens
    })
  });

  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({}));
    alert(erro.erro || 'Não foi possível salvar a nota.');
    return;
  }

  document.getElementById('secaoRevisaoNota').hidden = true;
  document.getElementById('notaArquivo').value = '';
  itensRevisaoNota = [];
  await carregarNotas();
  alert('Nota salva! Custos dos perfumes vinculados foram atualizados.');
});

async function carregarNotas() {
  const resp = await fetch('/api/notas');
  const notas = await resp.json();
  const container = document.getElementById('listaNotas');

  if (notas.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhuma nota importada ainda.</p>';
    return;
  }

  container.innerHTML = notas.map((n) => {
    const vinculados = (n.itens || []).filter((i) => i.perfumeNome).length;
    return `
    <div class="nota-item">
      <div class="nota-topo">
        <span class="nota-fornecedor">${escaparHTML(n.fornecedor)}</span>
        <span class="nota-valor">R$ ${Number(n.valorTotal).toFixed(2).replace('.', ',')}</span>
      </div>
      <div class="nota-data">${escaparHTML(formatarDataNota(n.data))}</div>
      <div class="nota-itens-resumo">${(n.itens || []).length} item(ns) · ${vinculados} vinculado(s) ao catálogo</div>
      <div class="pedido-acoes">
        <button type="button" class="btn-pequeno cancelar btn-excluir-nota" data-id="${n.id}">🗑️ Excluir</button>
      </div>
    </div>
  `;
  }).join('');
}

function formatarDataNota(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

document.getElementById('listaNotas').addEventListener('click', async (e) => {
  const botao = e.target.closest('.btn-excluir-nota');
  if (!botao) return;
  if (!confirm('Excluir essa nota? Isso não desfaz o custo já atualizado nos perfumes.')) return;
  await fetch(`/api/notas/${botao.dataset.id}`, { method: 'DELETE' });
  await carregarNotas();
});

document.querySelector('[data-aba="aba-notas"]').addEventListener('click', () => {
  carregarNotas();
  carregarPerfumesParaNotas();
});

carregarNotas();

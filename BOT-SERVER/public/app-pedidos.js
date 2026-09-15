let pedidosCache = [];
let filtroStatusAtual = 'Pendente';

const TITULOS_STATUS = {
  'Pendente': 'Pedidos pendentes',
  'Confirmado': 'Pedidos confirmados',
  'A Prazo': 'Pedidos a prazo',
  'Cancelado': 'Pedidos cancelados'
};

function classeStatus(status) {
  return status.replace(/\s+/g, '');
}

const OPCOES_PAGAMENTO = ['Pix', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito'];

// pedidos antigos já guardam o preço como "R$ 189,98" (texto cru vindo do WhatsApp);
// pedidos novos guardam só o número — não duplicar o prefixo nos dois casos
function formatarPreco(preco) {
  if (!preco) return '';
  const texto = String(preco).trim();
  return /^r\$/i.test(texto) ? texto : `R$ ${texto}`;
}

async function carregarPedidos() {
  const resp = await fetch('/api/pedidos');
  pedidosCache = await resp.json();
  atualizarContagens();
  renderizarPedidos();
}

function atualizarContagens() {
  document.querySelectorAll('.btn-status').forEach((btn) => {
    const status = btn.dataset.status;
    const total = pedidosCache.filter((p) => p.status === status).length;
    btn.querySelector('.contagem').textContent = total;
  });
}

function renderizarPedidos() {
  const container = document.getElementById('listaPedidos');
  document.getElementById('tituloListaPedidos').textContent = TITULOS_STATUS[filtroStatusAtual] || 'Pedidos';

  const filtrados = pedidosCache.filter((p) => p.status === filtroStatusAtual);

  if (filtrados.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhum pedido nessa categoria.</p>';
    return;
  }

  container.innerHTML = filtrados.map((p) => {
    const selo = `<span class="selo-status ${classeStatus(p.status)}">${escaparHTML(p.status)}</span>`;

    let acoes = '';
    if (p.status === 'Pendente') {
      acoes = `
        <select class="select-pagamento">
          <option value="Pix">Pix</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Cartão de Débito">Cartão de Débito</option>
          <option value="Cartão de Crédito">Cartão de Crédito</option>
          <option value="A Prazo">A Prazo (fiado)</option>
        </select>
        <input type="date" class="input-vencimento" hidden />
        <button type="button" class="btn-pequeno confirmar" data-linha="${p.linha}">✅ Confirmar</button>
        <button type="button" class="btn-pequeno cancelar" data-linha="${p.linha}">❌ Cancelar</button>
      `;
    } else if (p.status === 'A Prazo') {
      const comprovante = p.comprovanteRecebido === 'Sim'
        ? '<span class="pedido-detalhe">✅ Comprovante recebido</span>'
        : `<button type="button" class="btn-pequeno comprovante" data-linha="${p.linha}">📎 Marcar comprovante recebido</button>`;
      acoes = `
        <span class="pedido-detalhe">Vencimento: ${escaparHTML(formatarData(p.dataVencimento))}</span>
        ${comprovante}
        <button type="button" class="btn-pequeno confirmar" data-linha="${p.linha}" data-forma="Pix">💰 Pagamento recebido</button>
        <button type="button" class="btn-pequeno reabrir" data-linha="${p.linha}">↩️ Reabrir</button>
      `;
    } else if (p.status === 'Confirmado') {
      acoes = `
        <button type="button" class="btn-pequeno reabrir btn-toggle-pagamento" data-linha="${p.linha}">✏️ Alterar pagamento</button>
        <button type="button" class="btn-pequeno reabrir" data-linha="${p.linha}">↩️ Reabrir</button>
        <div class="editor-pagamento" data-linha="${p.linha}" hidden>
          <select class="select-pagamento-editar">
            ${OPCOES_PAGAMENTO.map((op) => `<option value="${op}" ${op === p.formaPagamentoConfirmada ? 'selected' : ''}>${op}</option>`).join('')}
          </select>
          <button type="button" class="btn-pequeno confirmar btn-salvar-pagamento" data-linha="${p.linha}">💾 Salvar</button>
        </div>
      `;
    } else {
      acoes = `<button type="button" class="btn-pequeno reabrir" data-linha="${p.linha}">↩️ Reabrir</button>`;
    }

    return `
    <div class="pedido-item">
      <div class="pedido-topo">
        <span class="pedido-data">${escaparHTML(p.data)}</span>
        <span class="pedido-numero">${escaparHTML(p.numero)} ${selo}</span>
      </div>
      <div class="pedido-produto">${escaparHTML(p.produto)}${p.preco ? ' — ' + escaparHTML(formatarPreco(p.preco)) : ''}</div>
      <div class="pedido-detalhe">Cliente: ${escaparHTML(p.cliente)}</div>
      <div class="pedido-detalhe">Pagamento informado pelo cliente: ${escaparHTML(p.pagamento)}</div>
      <div class="pedido-detalhe">Entrega: ${escaparHTML(p.entrega)}</div>
      <div class="pedido-detalhe">${escaparHTML(p.enderecoOuHorario)}</div>
      ${p.formaPagamentoConfirmada ? `<div class="pedido-detalhe">Forma de pagamento confirmada: ${escaparHTML(p.formaPagamentoConfirmada)}</div>` : ''}
      <div class="pedido-acoes">${acoes}</div>
    </div>
  `;
  }).join('');
}

function formatarData(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function mudarStatusPedido(linha, status, formaPagamento, dataVencimento) {
  const resp = await fetch(`/api/pedidos/${linha}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, formaPagamento, dataVencimento })
  });
  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({}));
    alert(erro.erro || 'Não foi possível atualizar o pedido.');
    return;
  }
  await carregarPedidos();
}

document.getElementById('btnAtualizarPedidos').addEventListener('click', carregarPedidos);
document.querySelector('[data-aba="aba-pedidos"]').addEventListener('click', carregarPedidos);
carregarPedidos();

// ---------- venda presencial (cadastro manual) ----------

let perfumesCatalogoPedidos = [];

async function carregarPerfumesParaVendaPresencial() {
  try {
    const resp = await fetch('/api/perfumes');
    perfumesCatalogoPedidos = await resp.json();
    const select = document.getElementById('vpProduto');
    select.innerHTML = perfumesCatalogoPedidos
      .map((p, i) => `<option value="${i}">${escaparHTML(p.marca)} - ${escaparHTML(p.nome)}</option>`)
      .join('');
    atualizarPrecoVendaPresencial();
  } catch {
    perfumesCatalogoPedidos = [];
  }
}

function atualizarPrecoVendaPresencial() {
  const perfume = perfumesCatalogoPedidos[Number(document.getElementById('vpProduto').value)];
  document.getElementById('vpPreco').value = perfume && perfume.preco != null ? perfume.preco : '';
}

document.getElementById('btnAbrirVendaPresencial').addEventListener('click', async () => {
  await carregarPerfumesParaVendaPresencial();
  document.getElementById('formVendaPresencial').hidden = false;
});

document.getElementById('vpProduto').addEventListener('change', atualizarPrecoVendaPresencial);

document.getElementById('btnCancelarVendaPresencial').addEventListener('click', () => {
  document.getElementById('formVendaPresencial').hidden = true;
  document.getElementById('vpCliente').value = '';
});

document.getElementById('btnSalvarVendaPresencial').addEventListener('click', async () => {
  const perfume = perfumesCatalogoPedidos[Number(document.getElementById('vpProduto').value)];
  const cliente = document.getElementById('vpCliente').value.trim();
  if (!perfume || !cliente) {
    alert('Escolha o produto e digite o nome do cliente.');
    return;
  }

  const resp = await fetch('/api/pedidos/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cliente,
      produto: `${perfume.marca} - ${perfume.nome}`,
      preco: document.getElementById('vpPreco').value,
      pagamento: document.getElementById('vpPagamento').value
    })
  });
  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({}));
    alert(erro.erro || 'Não foi possível salvar a venda.');
    return;
  }

  document.getElementById('formVendaPresencial').hidden = true;
  document.getElementById('vpCliente').value = '';

  document.querySelectorAll('.btn-status').forEach((b) => b.classList.remove('ativa'));
  document.querySelector('.btn-status[data-status="Confirmado"]').classList.add('ativa');
  filtroStatusAtual = 'Confirmado';
  await carregarPedidos();
});

document.querySelectorAll('.btn-status').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-status').forEach((b) => b.classList.remove('ativa'));
    btn.classList.add('ativa');
    filtroStatusAtual = btn.dataset.status;
    renderizarPedidos();
  });
});

document.getElementById('listaPedidos').addEventListener('change', (e) => {
  if (e.target.classList.contains('select-pagamento')) {
    const card = e.target.closest('.pedido-item');
    const inputVencimento = card.querySelector('.input-vencimento');
    inputVencimento.hidden = e.target.value !== 'A Prazo';
  }
});

document.getElementById('listaPedidos').addEventListener('click', async (e) => {
  const botao = e.target.closest('button');
  if (!botao) return;
  const linha = botao.dataset.linha;
  const card = botao.closest('.pedido-item');

  if (botao.classList.contains('confirmar')) {
    if (botao.dataset.forma) {
      // "Pagamento recebido" num pedido A Prazo → vira Confirmado direto
      await mudarStatusPedido(linha, 'Confirmado', botao.dataset.forma, null);
      return;
    }
    const forma = card.querySelector('.select-pagamento').value;
    if (forma === 'A Prazo') {
      const dataVencimento = card.querySelector('.input-vencimento').value;
      if (!dataVencimento) {
        alert('Escolha a data de vencimento pro pedido a prazo.');
        return;
      }
      await mudarStatusPedido(linha, 'A Prazo', forma, dataVencimento);
    } else {
      await mudarStatusPedido(linha, 'Confirmado', forma, null);
    }
  } else if (botao.classList.contains('cancelar')) {
    if (confirm('Cancelar esse pedido?')) {
      await mudarStatusPedido(linha, 'Cancelado', '', null);
    }
  } else if (botao.classList.contains('reabrir')) {
    await mudarStatusPedido(linha, 'Pendente', '', null);
  } else if (botao.classList.contains('comprovante')) {
    await fetch(`/api/pedidos/${linha}/comprovante`, { method: 'POST' });
    await carregarPedidos();
  } else if (botao.classList.contains('btn-toggle-pagamento')) {
    const editor = card.querySelector(`.editor-pagamento[data-linha="${linha}"]`);
    editor.hidden = !editor.hidden;
  } else if (botao.classList.contains('btn-salvar-pagamento')) {
    const novaForma = botao.closest('.editor-pagamento').querySelector('.select-pagamento-editar').value;
    await mudarStatusPedido(linha, 'Confirmado', novaForma, null);
  }
});

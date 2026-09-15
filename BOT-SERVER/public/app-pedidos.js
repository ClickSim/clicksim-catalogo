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
    } else {
      acoes = `<button type="button" class="btn-pequeno reabrir" data-linha="${p.linha}">↩️ Reabrir</button>`;
    }

    return `
    <div class="pedido-item">
      <div class="pedido-topo">
        <span class="pedido-data">${escaparHTML(p.data)}</span>
        <span class="pedido-numero">${escaparHTML(p.numero)} ${selo}</span>
      </div>
      <div class="pedido-produto">${escaparHTML(p.produto)}${p.preco ? ' — R$ ' + escaparHTML(p.preco) : ''}</div>
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
  }
});

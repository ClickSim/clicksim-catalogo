function formatarMoeda(valor) {
  return 'R$ ' + Number(valor || 0).toFixed(2).replace('.', ',');
}

function primeiroDiaDoMes() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
}

function hojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

async function carregarFinanceiro() {
  const inicio = document.getElementById('finInicio').value;
  const fim = document.getElementById('finFim').value;
  const params = new URLSearchParams();
  if (inicio) params.set('inicio', inicio);
  if (fim) params.set('fim', fim);

  const resp = await fetch(`/api/financeiro?${params.toString()}`);
  const dados = await resp.json();

  document.getElementById('finReceita').textContent = formatarMoeda(dados.receita);
  document.getElementById('finCustos').textContent = formatarMoeda(dados.custos);
  document.getElementById('finLucro').textContent = formatarMoeda(dados.lucro);
  document.getElementById('finNumPedidos').textContent = `${dados.numPedidos} pedido(s)`;
  document.getElementById('finNumNotas').textContent = `${dados.numNotas} nota(s)`;
}

document.getElementById('btnAtualizarFinanceiro').addEventListener('click', carregarFinanceiro);
document.querySelector('[data-aba="aba-financeiro"]').addEventListener('click', carregarFinanceiro);

document.getElementById('finInicio').value = primeiroDiaDoMes();
document.getElementById('finFim').value = hojeISO();

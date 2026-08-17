const PASTA_IMAGENS = "../EDICAO/imagens/";

const catalogo = document.getElementById("catalogo");
const busca = document.getElementById("busca");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroGenero = document.getElementById("filtroGenero");
document.getElementById("ano").textContent = new Date().getFullYear();
document.getElementById("linkWhatsappTopo").href = `https://wa.me/${NUMERO_WHATSAPP}`;

const modalFundo = document.getElementById("modalFundo");
const modalPerfume = document.getElementById("modalPerfume");
const inputNome = document.getElementById("inputNome");
const inputPagamento = document.getElementById("inputPagamento");
const inputEntrega = document.getElementById("inputEntrega");
const campoEndereco = document.getElementById("campoEndereco");
const campoHorario = document.getElementById("campoHorario");
const inputEndereco = document.getElementById("inputEndereco");
const inputHorario = document.getElementById("inputHorario");
const modalErro = document.getElementById("modalErro");

function normalizarImagem(p) {
  if (Array.isArray(p.imagens)) {
    p.imagens = p.imagens.slice(0, 5);
  } else if (p.imagem) {
    let img = p.imagem;
    if (img.startsWith("imagens/")) img = img.slice("imagens/".length);
    p.imagens = [img];
  } else {
    p.imagens = [];
  }
  delete p.imagem;
  return p;
}

function resolverImagem(src) {
  if (!src) return "";
  return src.startsWith("data:") ? src : PASTA_IMAGENS + src;
}

async function carregarPerfumes() {
  try {
    const resp = await fetch("/api/perfumes");
    if (resp.ok) {
      const lista = await resp.json();
      if (Array.isArray(lista) && lista.length > 0) return lista.map(normalizarImagem);
    }
  } catch (erro) {
    console.warn("Não foi possível carregar o catálogo do servidor, usando cópia local:", erro);
  }
  // fallback: catálogo embutido no arquivo perfumes.js (usado se a API estiver fora do ar)
  return typeof PERFUMES !== "undefined" ? PERFUMES.map(normalizarImagem) : [];
}

let perfumes = [];
let perfumeSelecionado = null;

carregarPerfumes().then((lista) => {
  perfumes = lista;
  if (perfumes.length === 0) {
    catalogo.innerHTML = '<p class="sem-resultados">Não foi possível carregar o catálogo.</p>';
  } else {
    renderizar(perfumes);
  }
});

function formatarPreco(valor) {
  if (valor === null || valor === undefined) return "Consulte o valor";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function linkWhatsAppBase(p) {
  const mensagem = `Olá! Tenho interesse no produto: ${p.marca} - ${p.nome} (${formatarPreco(p.preco)}). Poderia me ajudar com o pedido?`;
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
}

function renderizar(lista) {
  if (lista.length === 0) {
    catalogo.innerHTML = '<p class="sem-resultados">Nenhum perfume encontrado.</p>';
    return;
  }

  catalogo.innerHTML = lista
    .map(
      (p, indice) => `
    <article class="card">
      <div class="card-imagem" data-indice="${indice}">
        ${p.maisVendido ? '<span class="selo-mais-vendido">Mais vendido</span>' : ""}
        ${
          p.imagens[0]
            ? `<img src="${resolverImagem(p.imagens[0])}" alt="${p.nome}" onerror="this.hidden=true; this.parentElement.querySelector('.sem-foto').hidden=false;">`
            : ""
        }
        <span class="sem-foto" ${p.imagens[0] ? "hidden" : ""}>Sem foto</span>
        ${
          p.imagens.length > 1
            ? `
          <button type="button" class="galeria-seta galeria-anterior" aria-label="Foto anterior">‹</button>
          <button type="button" class="galeria-seta galeria-proxima" aria-label="Próxima foto">›</button>
          <div class="galeria-pontos">${p.imagens.map((_, i) => `<span class="ponto${i === 0 ? " ativo" : ""}"></span>`).join("")}</div>
        `
            : ""
        }
      </div>
      <div class="card-corpo">
        <span class="card-marca">${p.marca}</span>
        <h2 class="card-nome">${p.nome}</h2>
        <p class="card-descricao">${p.descricao || ""}</p>
        <span class="card-preco">${formatarPreco(p.preco)}</span>
        <a class="btn-comprar" href="${linkWhatsAppBase(p)}" target="_blank" rel="noopener" data-nome="${p.nome}">Comprar</a>
      </div>
    </article>
  `
    )
    .join("");

  document.querySelectorAll(".card-imagem").forEach((el) => {
    const p = lista[Number(el.dataset.indice)];
    if (p.imagens.length <= 1) return;
    const imgEl = el.querySelector("img");
    const pontos = el.querySelectorAll(".ponto");
    let atual = 0;
    function mostrar(i) {
      atual = (i + p.imagens.length) % p.imagens.length;
      if (imgEl) imgEl.src = resolverImagem(p.imagens[atual]);
      pontos.forEach((pt, i2) => pt.classList.toggle("ativo", i2 === atual));
    }
    el.querySelector(".galeria-anterior").addEventListener("click", (e) => {
      e.stopPropagation();
      mostrar(atual - 1);
    });
    el.querySelector(".galeria-proxima").addEventListener("click", (e) => {
      e.stopPropagation();
      mostrar(atual + 1);
    });
  });

  document.querySelectorAll(".btn-comprar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModal(btn.dataset.nome);
    });
  });
}

function abrirModal(nomePerfume) {
  perfumeSelecionado = perfumes.find((p) => p.nome === nomePerfume);
  if (!perfumeSelecionado) return;

  modalPerfume.textContent = `${perfumeSelecionado.marca} - ${perfumeSelecionado.nome} (${formatarPreco(perfumeSelecionado.preco)})`;
  inputNome.value = "";
  inputPagamento.value = "Pix";
  inputEntrega.value = "Retirada";
  inputEndereco.value = "";
  inputHorario.value = "";
  modalErro.textContent = "";
  atualizarCamposEntrega();
  modalFundo.classList.add("aberto");
}

function atualizarCamposEntrega() {
  const isEntrega = inputEntrega.value === "Entrega";
  campoEndereco.hidden = !isEntrega;
  campoHorario.hidden = isEntrega;
}

inputEntrega.addEventListener("change", atualizarCamposEntrega);

function fecharModal() {
  modalFundo.classList.remove("aberto");
  perfumeSelecionado = null;
}

document.getElementById("fecharModal").addEventListener("click", fecharModal);
modalFundo.addEventListener("click", (e) => {
  if (e.target === modalFundo) fecharModal();
});

document.getElementById("enviarPedido").addEventListener("click", () => {
  const nome = inputNome.value.trim();
  const pagamento = inputPagamento.value;
  const entrega = inputEntrega.value;
  const endereco = inputEndereco.value.trim();
  const horario = inputHorario.value;

  if (!nome) {
    modalErro.textContent = "Por favor, informe seu nome.";
    return;
  }
  if (entrega === "Entrega" && !endereco) {
    modalErro.textContent = "Por favor, informe o endereço para entrega.";
    return;
  }
  if (entrega === "Retirada" && !horario) {
    modalErro.textContent = "Por favor, escolha um horário para retirada.";
    return;
  }
  if (!perfumeSelecionado) return;

  let mensagem =
    `Olá! Gostaria de fazer um pedido:\n\n` +
    `*Cliente:* ${nome}\n` +
    `*Produto:* ${perfumeSelecionado.marca} - ${perfumeSelecionado.nome}\n` +
    `*Preço:* ${formatarPreco(perfumeSelecionado.preco)}\n` +
    `*Forma de pagamento:* ${pagamento}\n` +
    `*Entrega:* ${entrega === "Entrega" ? "Entrega no endereço" : "Retirar no local"}\n`;

  if (entrega === "Entrega") {
    mensagem += `*Endereço:* ${endereco}`;
  } else {
    mensagem += `*Horário de retirada:* ${horario}`;
  }

  const link = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
  window.location.href = link;
  fecharModal();
});

const infoTester = document.getElementById("infoTester");

function aplicarFiltros() {
  const termo = busca.value.trim().toLowerCase();
  const categoria = filtroCategoria.value;
  const genero = filtroGenero.value;

  infoTester.hidden = categoria !== "Tester";

  const filtrados = perfumes.filter((p) => {
    const combinaTexto =
      p.nome.toLowerCase().includes(termo) || p.marca.toLowerCase().includes(termo);
    const combinaCategoria =
      categoria === "todos" ||
      (categoria === "Promocao" ? p.promocao === true : p.categoria === categoria);
    const combinaGenero = genero === "todos" || p.genero === genero;
    return combinaTexto && combinaCategoria && combinaGenero;
  });

  renderizar(filtrados);
}

busca.addEventListener("input", aplicarFiltros);
filtroCategoria.addEventListener("change", aplicarFiltros);
filtroGenero.addEventListener("change", aplicarFiltros);

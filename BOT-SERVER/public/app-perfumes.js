const CHAVE_CONFIG = "clicksim_config";
const PASTA_IMAGENS = "https://clicksim.github.io/clicksim-catalogo/EDICAO/imagens/";

inicializarPainelPerfumes();

async function inicializarPainelPerfumes() {
  // precisa vir antes do carregarPerfumes() abaixo — normalizarImagem() usa MAX_FOTOS
  // durante esse carregamento, e como const não é hoisted, declarar depois causava
  // "Cannot access 'MAX_FOTOS' before initialization" e derrubava o carregamento real,
  // caindo no catálogo de reserva desatualizado.
  const MAX_FOTOS = 5;
  let perfumes = await carregarPerfumes();
  let idEmEdicao = null;

  const listaEl = document.getElementById("listaPerfumes");
  const totalEl = document.getElementById("totalProdutos");
  const buscaProdutoEl = document.getElementById("buscaProduto");
  const form = document.getElementById("formPerfume");
  const tituloForm = document.getElementById("tituloForm");
  const btnSalvarProduto = document.getElementById("btnSalvarProduto");
  const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");

  const fNome = document.getElementById("fNome");
  const fMarca = document.getElementById("fMarca");
  const fCategoria = document.getElementById("fCategoria");
  const fGenero = document.getElementById("fGenero");
  const fPreco = document.getElementById("fPreco");
  const fFotos = document.getElementById("fFotos");
  const previewFotosEl = document.getElementById("previewFotos");
  let fotosAtuais = [];
  const fDescricao = document.getElementById("fDescricao");
  const fMaisVendido = document.getElementById("fMaisVendido");
  const fPromocao = document.getElementById("fPromocao");

  const fWhatsapp = document.getElementById("fWhatsapp");

  async function carregarNumeroWhatsapp() {
    try {
      const resp = await fetch("/api/config");
      if (resp.ok) {
        const config = await resp.json();
        if (config && config.numeroWhatsapp) return config.numeroWhatsapp;
      }
    } catch (erro) {
      console.warn("Não foi possível carregar o número salvo:", erro);
    }
    return "";
  }

  function normalizarImagem(p) {
    if (Array.isArray(p.imagens)) {
      p.imagens = p.imagens.slice(0, MAX_FOTOS);
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
    if (src.startsWith("data:") || src.startsWith("http")) return src;
    return PASTA_IMAGENS + src;
  }

  async function carregarPerfumes() {
    try {
      const resp = await fetch("/api/perfumes");
      if (resp.ok) {
        const lista = await resp.json();
        if (Array.isArray(lista)) return lista.map(normalizarImagem);
      }
    } catch (erro) {
      console.warn("Não foi possível carregar o catálogo do servidor:", erro);
    }
    return typeof PERFUMES !== "undefined" ? JSON.parse(JSON.stringify(PERFUMES)).map(normalizarImagem) : [];
  }

  async function salvar() {
    try {
      await fetch("/api/perfumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perfumes)
      });
    } catch (erro) {
      console.warn("Não foi possível salvar no servidor:", erro);
      alert("Não foi possível salvar as alterações no servidor. Verifique sua conexão e tente de novo.");
    }
  }

  function formatarPreco(valor) {
    if (valor === null || valor === undefined || valor === "") return "Consulte o valor";
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function correspondeABusca(p, termo) {
    if (!termo) return true;
    const alvo = `${p.nome} ${p.marca}`.toLowerCase();
    return alvo.includes(termo.toLowerCase());
  }

  function renderizarLista() {
    totalEl.textContent = perfumes.length;

    if (perfumes.length === 0) {
      listaEl.innerHTML = '<p class="vazio">Nenhum produto cadastrado ainda.</p>';
      return;
    }

    const termoBusca = buscaProdutoEl ? buscaProdutoEl.value.trim() : "";
    const itensFiltrados = perfumes
      .map((p, indice) => ({ p, indice }))
      .filter(({ p }) => correspondeABusca(p, termoBusca));

    if (itensFiltrados.length === 0) {
      listaEl.innerHTML = '<p class="vazio">Nenhum produto encontrado pra essa busca.</p>';
      return;
    }

    listaEl.innerHTML = itensFiltrados
      .map(
        ({ p, indice }) => `
      <div class="item-perfume" draggable="true" data-indice="${indice}">
        <span class="item-arraste">☰</span>
        <div class="item-foto">
          <img src="${resolverImagem(p.imagens && p.imagens[0])}" alt="${p.nome}" onerror="this.parentElement.innerHTML='<span class=\\'sem-foto\\'>Sem foto</span>'">
        </div>
        <div class="item-info">
          <div class="item-marca">${p.marca}</div>
          <div class="item-nome">${p.nome}</div>
          <div class="item-tags">
            <span class="item-tag">${p.categoria}</span>
            <span class="item-tag">${p.genero}</span>
            ${p.maisVendido ? '<span class="item-tag">Mais vendido</span>' : ""}
            ${p.promocao ? '<span class="item-tag">Promoção</span>' : ""}
          </div>
        </div>
        <div class="item-preco">${formatarPreco(p.preco)}</div>
        <div class="item-botoes">
          <button type="button" class="btn btn-secundario btn-editar" data-indice="${indice}">Editar</button>
          <button type="button" class="btn btn-perigo btn-excluir" data-indice="${indice}">Excluir</button>
        </div>
      </div>
    `
      )
      .join("");

    listaEl.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", () => iniciarEdicao(Number(btn.dataset.indice)));
    });
    listaEl.querySelectorAll(".btn-excluir").forEach((btn) => {
      btn.addEventListener("click", () => excluirProduto(Number(btn.dataset.indice)));
    });

    ativarArraste();
  }

  function ativarArraste() {
    const itens = listaEl.querySelectorAll(".item-perfume");
    let indiceOrigem = null;

    itens.forEach((item) => {
      item.addEventListener("dragstart", () => {
        indiceOrigem = Number(item.dataset.indice);
        item.classList.add("arrastando");
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("arrastando");
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        const indiceDestino = Number(item.dataset.indice);
        if (indiceOrigem === null || indiceOrigem === indiceDestino) return;
        const [movido] = perfumes.splice(indiceOrigem, 1);
        perfumes.splice(indiceDestino, 0, movido);
        salvar();
        renderizarLista();
      });
    });
  }

  function limparFormulario() {
    idEmEdicao = null;
    form.reset();
    fCategoria.value = "Perfume";
    fGenero.value = "Feminino";
    fotosAtuais = [];
    renderizarPreviewFotos();
    tituloForm.textContent = "Adicionar novo perfume";
    btnSalvarProduto.textContent = "Adicionar produto";
    btnCancelarEdicao.hidden = true;
  }

  function iniciarEdicao(indice) {
    const p = perfumes[indice];
    idEmEdicao = indice;
    fNome.value = p.nome || "";
    fMarca.value = p.marca || "";
    fCategoria.value = p.categoria || "Perfume";
    fGenero.value = p.genero || "Feminino";
    fPreco.value = p.preco === null || p.preco === undefined ? "" : p.preco;
    fDescricao.value = p.descricao || "";
    fMaisVendido.checked = !!p.maisVendido;
    fPromocao.checked = !!p.promocao;
    fotosAtuais = [...(p.imagens || [])];
    renderizarPreviewFotos();
    tituloForm.textContent = "Editando: " + p.nome;
    btnSalvarProduto.textContent = "Salvar alterações";
    btnCancelarEdicao.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluirProduto(indice) {
    const p = perfumes[indice];
    if (!confirm(`Remover "${p.nome}" do catálogo?`)) return;
    perfumes.splice(indice, 1);
    salvar();
    renderizarLista();
    if (idEmEdicao === indice) limparFormulario();
  }

  function renderizarPreviewFotos() {
    previewFotosEl.innerHTML =
      fotosAtuais
        .map(
          (src, i) => `
      <div class="foto-preview-item">
        <img src="${resolverImagem(src)}" alt="Foto ${i + 1}">
        <button type="button" class="btn-remover-foto" data-indice="${i}" aria-label="Remover foto">×</button>
      </div>
    `
        )
        .join("") || '<span class="sem-foto">Nenhuma foto adicionada ainda</span>';

    previewFotosEl.querySelectorAll(".btn-remover-foto").forEach((btn) => {
      btn.addEventListener("click", () => {
        fotosAtuais.splice(Number(btn.dataset.indice), 1);
        renderizarPreviewFotos();
      });
    });
  }

  function lerArquivoComoDataURL(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = reject;
      leitor.readAsDataURL(arquivo);
    });
  }

  async function enviarFotoParaServidor(dataUrl) {
    const resp = await fetch("/api/upload-imagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl })
    });
    if (!resp.ok) throw new Error("upload falhou");
    const { url } = await resp.json();
    return url;
  }

  async function adicionarFotos(arquivos) {
    const espacoLivre = MAX_FOTOS - fotosAtuais.length;
    if (espacoLivre <= 0) {
      alert(`Máximo de ${MAX_FOTOS} fotos por produto.`);
      return;
    }
    const selecionados = Array.from(arquivos).slice(0, espacoLivre);
    fFotos.disabled = true;
    for (const arquivo of selecionados) {
      try {
        const dataUrl = await lerArquivoComoDataURL(arquivo);
        const url = await enviarFotoParaServidor(dataUrl);
        fotosAtuais.push(url);
        renderizarPreviewFotos();
      } catch (erro) {
        console.warn("Não foi possível enviar a imagem:", erro);
        alert("Não foi possível enviar uma das fotos. Tente de novo.");
      }
    }
    fFotos.disabled = false;
  }

  fFotos.addEventListener("change", (e) => {
    adicionarFotos(e.target.files);
    fFotos.value = "";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const dados = {
      nome: fNome.value.trim(),
      marca: fMarca.value.trim(),
      categoria: fCategoria.value,
      preco: fPreco.value === "" ? null : Number(fPreco.value),
      genero: fGenero.value,
      imagens: [...fotosAtuais],
      descricao: fDescricao.value.trim(),
    };
    if (fMaisVendido.checked) dados.maisVendido = true;
    if (fPromocao.checked) dados.promocao = true;

    if (idEmEdicao !== null) {
      perfumes[idEmEdicao] = dados;
    } else {
      perfumes.push(dados);
    }

    salvar();
    renderizarLista();
    limparFormulario();
  });

  btnCancelarEdicao.addEventListener("click", limparFormulario);

  document.getElementById("btnSalvarWhatsapp").addEventListener("click", async () => {
    const numero = fWhatsapp.value.replace(/\D/g, "");
    if (!numero) {
      alert("Digite o número de WhatsApp (só números, com DDI+DDD).");
      return;
    }
    fWhatsapp.value = numero;
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroWhatsapp: numero })
      });
      alert("Número salvo! Já atualizou no catálogo.");
    } catch (erro) {
      console.warn("Não foi possível salvar o número:", erro);
      alert("Não foi possível salvar. Verifique sua conexão e tente de novo.");
    }
  });

  if (buscaProdutoEl) {
    buscaProdutoEl.addEventListener("input", () => renderizarLista());
  }

  const btnAtualizarProdutos = document.getElementById("btnAtualizarProdutos");
  if (btnAtualizarProdutos) {
    btnAtualizarProdutos.addEventListener("click", async () => {
      btnAtualizarProdutos.disabled = true;
      btnAtualizarProdutos.textContent = "Atualizando...";
      perfumes = await carregarPerfumes();
      renderizarLista();
      btnAtualizarProdutos.disabled = false;
      btnAtualizarProdutos.textContent = "🔄 Atualizar produtos";
    });
  }

  fWhatsapp.value = await carregarNumeroWhatsapp();

  limparFormulario();
  renderizarLista();
}

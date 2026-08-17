document.querySelectorAll(".btn-aba").forEach((botao) => {
  botao.addEventListener("click", () => {
    document.querySelectorAll(".btn-aba").forEach((b) => b.classList.remove("ativa"));
    document.querySelectorAll(".conteudo-aba").forEach((c) => c.classList.remove("ativa"));
    botao.classList.add("ativa");
    document.getElementById(botao.dataset.aba).classList.add("ativa");
  });
});

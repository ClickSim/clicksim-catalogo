// Edite esta lista para adicionar, remover ou alterar produtos.
// "imagem" é só o nome do arquivo dentro da pasta EDICAO/imagens (sem caminho).
// Se "preco" for null, o card mostra "Consulte o valor".
const PERFUMES = [
  {
    nome: "Al Layl 100ml EDP – Masculino",
    marca: "Al Wataniah",
    categoria: "Perfume",
    preco: 189.98,
    genero: "Masculino",
    maisVendido: true,
    imagem: "al-layl.jpg",
    descricao: "Oriental Amadeirado. Topo: especiarias. Coração: notas quentes. Fundo: âmbar, madeiras."
  },
  {
    nome: "Yara 100ml EDP – Feminino",
    marca: "Lattafa",
    categoria: "Perfume",
    preco: 259.00,
    genero: "Feminino",
    maisVendido: true,
    imagem: "yara-cs.jpg",
    descricao: "Floral Frutado Gourmand. Topo: orquídea, heliotrópio, tangerina. Coração: acorde gourmand, frutas tropicais. Fundo: baunilha, almíscar, sândalo."
  },
  {
    nome: "Durrat Al Aroos 100ml EDP – Feminino",
    marca: "Al Wataniah",
    categoria: "Perfume",
    preco: 179.98,
    genero: "Feminino",
    imagem: "durrat-al-aroos.jpg",
    descricao: "Floral Oriental. Topo: notas doces, frutas. Coração: flores brancas. Fundo: baunilha, âmbar, almíscar."
  },
  {
    nome: "Sabah Al Ward Delilah EDP – Feminino",
    marca: "Al Wataniah",
    categoria: "Perfume",
    preco: 299.98,
    genero: "Feminino",
    imagem: "sabah-al-ward-delilah.jpg",
    descricao: "Floral Frutado. Topo: frutas vermelhas, bergamota, tangerina. Coração: rosa, jasmim, peônia. Fundo: almíscar, notas amadeiradas."
  },
  {
    nome: "Blue Seduction Wave 100ml EDT – Masculino",
    marca: "Antonio Banderas",
    categoria: "Perfume",
    preco: 169.98,
    genero: "Masculino",
    imagem: "blue-seduction-wave.jpg",
    descricao: "Aromático Aquático. Topo: notas marinhas, frutas. Coração: notas aromáticas. Fundo: almíscar, madeiras."
  },
  {
    nome: "Her Secret Desire 80ml EDT – Feminino",
    marca: "Antonio Banderas",
    categoria: "Perfume",
    preco: 149.98,
    genero: "Feminino",
    imagem: "her-secret-desire.jpg",
    descricao: "Floral Gourmand. Topo: framboesa, bergamota. Coração: íris, jasmim. Fundo: baunilha, sândalo."
  },
  {
    nome: "Power of Seduction (confirmar edição) – Masculino",
    marca: "Antonio Banderas",
    categoria: "Perfume",
    preco: 199.98,
    genero: "Masculino",
    imagem: "power-of-seduction.jpg",
    descricao: "Nome cortado no print original — confirmar edição/ml exatos antes de divulgar."
  },
  {
    nome: "The Golden Secret Tester 100ml EDT – Masculino",
    marca: "Antonio Banderas",
    categoria: "Tester",
    preco: 129,
    genero: "Masculino",
    imagem: "the-golden-secret-tester.jpg",
    descricao: "Oriental Especiado. Topo: hortelã, maçã. Coração: noz-moscada, pimenta. Fundo: couro, âmbar, madeira."
  },
  {
    nome: "The Icon For Women Tester 100ml EDP – Feminino",
    marca: "Antonio Banderas",
    categoria: "Tester",
    preco: 149.98,
    genero: "Feminino",
    imagem: "the-icon-tester.jpg",
    descricao: "Oriental Floral. Topo: pera, tangerina. Coração: flor de laranjeira, jasmim. Fundo: baunilha, almíscar, sândalo."
  },
  {
    nome: "The Secret Prata Tester 100ml EDT – Masculino",
    marca: "Antonio Banderas",
    categoria: "Tester",
    preco: 129.98,
    genero: "Masculino",
    imagem: "the-secret-prata-tester.jpg",
    descricao: "Oriental Amadeirado. Topo: especiarias, cítricos. Coração: notas aromáticas. Fundo: baunilha, madeira."
  },
  {
    nome: "Odyssey Mega 100ml EDP – Masculino",
    marca: "Armaf",
    categoria: "Perfume",
    preco: 239.00,
    genero: "Masculino",
    imagem: "odyssey-mega.jpg",
    descricao: "Aromático Amadeirado. Topo: laranja, bergamota, limão, gengibre, hortelã. Coração: abacaxi, zimbro, sálvia, gerânio. Fundo: almíscar, fava tonka, cedro, vetiver."
  },
  {
    nome: "Ameerat Al Arab Prive Rose 100ml EDP – Feminino",
    marca: "Asdaaf",
    categoria: "Perfume",
    preco: 199.98,
    genero: "Feminino",
    imagem: "ameerat-al-arab-prive-rose.jpg",
    descricao: "Floral Frutado. Topo: morango, uvas, laranja. Coração: rosa, almíscar branco, jasmim, ylang-ylang, gardênia, lírio. Fundo: fava tonka, âmbar, sândalo."
  },
  {
    nome: "Cactus Green 100ml EDT – Masculino",
    marca: "Benetton",
    categoria: "Perfume",
    preco: 159.98,
    genero: "Masculino",
    imagem: "cactus-green.jpg",
    descricao: "Aromático Verde. Topo: cítricos. Coração: notas verdes. Fundo: almíscar."
  },
  {
    nome: "Colors Man Black Intenso 60ml EDT – Masculino",
    marca: "Benetton",
    categoria: "Perfume",
    preco: 109.98,
    genero: "Masculino",
    imagem: "colors-man-black-intenso.jpg",
    descricao: "Amadeirado Aromático. Topo: cítricos. Coração: especiarias. Fundo: âmbar, madeiras."
  },
  {
    nome: "Sisterland Red Rose 80ml EDT – Feminino",
    marca: "Benetton",
    categoria: "Perfume",
    preco: 199.98,
    genero: "Feminino",
    imagem: "sisterland-red-rose.jpg",
    descricao: "Floral. Topo: notas frutadas. Coração: rosa. Fundo: almíscar, notas amadeiradas."
  },
  {
    nome: "Gabriela Sabatini Tester 60ml EDT – Feminino",
    marca: "Gabriela Sabatini",
    categoria: "Tester",
    preco: 79.00,
    genero: "Feminino",
    imagem: "gabriela-sabatini-tester.jpg",
    descricao: "Floral Oriental. Topo: frutas, bergamota. Coração: jasmim, rosa. Fundo: sândalo, âmbar, almíscar."
  },
  {
    nome: "Homme 75ml EDT – Masculino",
    marca: "Joop!",
    categoria: "Perfume",
    preco: 169.98,
    genero: "Masculino",
    imagem: "joop-homme.jpg",
    descricao: "Oriental Fougère. Topo: flor de laranjeira, bergamota. Coração: canela, heliotrópio. Fundo: baunilha, fava tonka, sândalo."
  },
  {
    nome: "Bareeq Al Dhahab 100ml EDP – Unissex",
    marca: "Lattafa",
    categoria: "Perfume",
    preco: 169.98,
    genero: "Unissex",
    imagem: "bareeq-al-dhahab-cs.jpg",
    descricao: "Oriental Gourmand. Topo: abacaxi, notas doces. Coração: baunilha, notas cremosas. Fundo: âmbar, almíscar, amadeiradas."
  },
  {
    nome: "Eclaire 100ml EDP – Feminino",
    marca: "Lattafa",
    categoria: "Perfume",
    preco: 339.00,
    genero: "Feminino",
    imagem: "eclaire.jpg",
    descricao: "Gourmand. Topo: notas doces, leite. Coração: caramelo, baunilha. Fundo: almíscar, notas amadeiradas."
  },
  {
    nome: "Hayaati Florence 100ml EDP – Feminino",
    marca: "Lattafa",
    categoria: "Perfume",
    preco: 189.98,
    genero: "Feminino",
    imagem: "hayaati-florence.jpg",
    descricao: "Floral Frutado. Topo: frutas, notas frescas. Coração: flores brancas, florais. Fundo: baunilha, almíscar, amadeiradas."
  },
  {
    nome: "Hayaati Gold Elixir 100ml EDP – Unissex",
    marca: "Lattafa",
    categoria: "Perfume",
    preco: 189.00,
    genero: "Unissex",
    imagem: "hayaati-gold-elixir.jpg",
    descricao: "Oriental Baunilha. Topo: notas doces, frutas. Coração: notas florais, acordes quentes. Fundo: baunilha, âmbar, almíscar."
  },
  {
    nome: "Sabonete em Barra Karité Madressenza – 180g",
    marca: "Madressenza",
    categoria: "Sabonete",
    preco: 35,
    genero: "Unissex",
    imagem: "sabonete-karite-madressenza.jpg",
    descricao: "Suave Conforto. Limpeza suave com sensação de hidratação e conforto. Fragrância delicada e aconchegante."
  },
  {
    nome: "Sabonete Líquido Romã Rubi Madressenza – 250ml",
    marca: "Madressenza",
    categoria: "Sabonete",
    preco: 119,
    genero: "Unissex",
    imagem: "sabonete-roma-rubi.jpg",
    descricao: "Frutado. Aroma inspirado na romã, levemente adocicado e vibrante. Contém pró-vitamina B5."
  },
  {
    nome: "I Love Love Tester 100ml EDT – Feminino",
    marca: "Moschino",
    categoria: "Tester",
    preco: 199,
    genero: "Feminino",
    imagem: "i-love-love-tester.jpg",
    descricao: "Floral Frutado. Topo: laranja, limão, toranja. Coração: rosa, lírio do vale. Fundo: almíscar, madeira."
  },
  {
    nome: "Colors Green 100ml EDT – Masculino",
    marca: "Nautica",
    categoria: "Perfume",
    preco: 169.98,
    genero: "Masculino",
    imagem: "nautica-colors-green.jpg",
    descricao: "Aromático Aquático. Topo: notas verdes, cítricos. Coração: lavanda, notas aquáticas. Fundo: almíscar, madeiras."
  },
  {
    nome: "Fluorite 100ml EDP – Feminino",
    marca: "Nawal",
    categoria: "Perfume",
    preco: 169.98,
    genero: "Feminino",
    imagem: "nawal-fluorite.jpg",
    descricao: "Floral Frutado. Topo: frutas, notas frescas. Coração: flores brancas. Fundo: almíscar, notas amadeiradas, toque adocicado."
  },
  {
    nome: "Sabonete em Barra Licor de Frutas Oilov – 90g",
    marca: "Oilov",
    categoria: "Sabonete",
    preco: 13,
    genero: "Unissex",
    imagem: "sabonete-licor-frutas-oilov.jpg",
    descricao: "Frutado Doce. Fragrância doce e envolvente, com toque descontraído. Limpeza suave e sensação de maciez."
  },
  {
    nome: "Dance Star Midnight 80ml EDT – Feminino",
    marca: "Shakira",
    categoria: "Perfume",
    preco: 149.98,
    genero: "Feminino",
    imagem: "dance-star-midnight.jpg",
    descricao: "Floral Frutado Gourmand. Topo: frutas vermelhas. Coração: flor de laranjeira. Fundo: baunilha, almíscar."
  }
];

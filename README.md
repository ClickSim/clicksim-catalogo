# Click Sim — estrutura do projeto

Esse projeto é a referência/template pra outras lojas — a ideia é replicar essa estrutura pra
cada novo cliente, trocando só o conteúdo (produtos, imagens, textos), mantendo o mesmo
esqueleto. Segue o padrão de organização usado nos catálogos/cardápios da consultoria:

- **SISTEMA/** — o site em si, o que o cliente final visita. Não precisa mexer aqui no dia a dia.
  - `index.html`, `style.css`, `script.js`
- **EDICAO/** — as fotos dos produtos e o catálogo original.
  - `imagens/` — fotos usadas no catálogo (o nome do arquivo é o que você digita no painel, sem "imagens/" na frente). Servida publicamente pelo `BOT-SERVER` em `/EDICAO/imagens/...`
  - `imagens perfume click sim/` — fotos originais recebidas por WhatsApp, ainda não processadas/cadastradas
  - `painel.html` — **não usar mais**, só redireciona pro painel unificado (ver `BOT-SERVER/` abaixo)
  - `perfumes.js` — catálogo original/seed, usado só como fallback se a API do `BOT-SERVER` estiver fora do ar (ver "Cadastro de perfumes" abaixo). Não é mais o que o cliente edita no dia a dia.
- **BOT/** — módulo **opcional** (item à parte pro cliente comprar ou não): painel de
  palavras-chave/respostas prontas pro atendimento no WhatsApp. Totalmente independente —
  não usa nada de `EDICAO/`, só as cores de `SISTEMA/style.css`. Pra vender o catálogo sem o
  bot, é só não entregar/remover essa pasta e o link "Configurar mensagens do bot" em
  `EDICAO/painel.html`.
- **REMARKETING/** — reservado para a planilha de contatos/leads (ver `REMARKETING/README.md`)
- **BOT-SERVER/** — servidor Node com o painel unificado (atendente WhatsApp + cadastro de
  perfumes) e a API do catálogo (`/api/perfumes`). Ver `## Cadastro de perfumes (autonomia do
  cliente)` abaixo pra entender como isso funciona, por que existe, e **o que ainda falta** pra
  funcionar de qualquer lugar (celular incluso).

## Onde cada coisa roda hoje (2026-08-17)

- **Catálogo público (`SISTEMA/`)**: publicado via **GitHub Pages**, direto do repositório
  `ClickSim/clicksim-catalogo` (migrado em 2026-08-17, ver seção "Acesso ao GitHub" abaixo) —
  **link confirmado no ar em 2026-08-17**:
  `https://clicksim.github.io/clicksim-catalogo/SISTEMA/index.html`. Não depende de nenhum
  servidor ligado; atualiza sozinho (leva 1-2 min) a cada `git push` na branch `main`. Esse é o
  link novo pra passar pro cliente (o antigo, `clicksim1.github.io/clicksimcatalogo/...`, parou de
  ser atualizado).
- **Painel (`BOT-SERVER`)**: roda de verdade no **Droplet DigitalOcean `clicksim-bot`**
  (`167.99.150.99`), gerenciado por PM2 (processo `clicksim-bot`), online 24h — **não** é só local
  (o `iniciar.vbs`/`PASSO_A_PASSO_INSTALACAO.md` descrevem um modo alternativo de rodar na sua
  própria máquina, mas o que está em produção é o Droplet). Acessível de qualquer lugar, celular
  incluso, em `https://167-99-150-99.sslip.io/` (login: ver `PAINEL_USUARIO`/`PAINEL_SENHA` em
  `server.js`). HTTPS via nginx + Let's Encrypt, domínio gratuito `sslip.io` (resolve sozinho pro
  IP do Droplet — não precisa configurar DNS). Esse Droplet também já rodava o bot de WhatsApp
  real do cliente havia 9+ dias antes dessa atualização — **nunca reiniciar/mexer na pasta `auth/`
  nem `data/` de lá sem cuidado**, é sessão e histórico reais.

## Cadastro de perfumes (autonomia do cliente)

**Histórico do problema (resolvido em 2026-08-17):** o painel de cadastro salvava os produtos só
no `localStorage` do navegador de quem estava editando. Isso nunca chegava ao catálogo público de
verdade — só parecia funcionar quando o teste era feito no mesmo navegador/computador de quem
cadastrou. O cliente cadastrou produtos novos e o catálogo publicado não atualizou porque a
mudança nunca saiu do navegador dele. Isso **já tinha sido corrigido uma vez antes** (na entrega
ao cliente) mas a correção nunca foi commitada/enviada ao GitHub, então nunca foi pro
DigitalOcean — e o bug voltou. Por isso este arquivo existe: pra essa correção não se perder de
novo.

**Como funciona agora:** o `BOT-SERVER/server.js` expõe uma API real:
- `GET /api/perfumes` — **pública, sem login** (o catálogo publicado em `SISTEMA/` busca os
  produtos daqui via `fetch`). Precisa ser pública pra qualquer visitante do site carregar sem
  senha.
- `POST /api/perfumes` — **exige login** (usuário/senha do painel, definidos em
  `PAINEL_USUARIO`/`PAINEL_SENHA` no topo de `server.js`). É o que o painel usa pra salvar depois
  de adicionar/editar/excluir/reordenar um produto.
- Os dados ficam em `BOT-SERVER/data/perfumes.json` (arquivo real no servidor, não no navegador).

Resultado: o cliente cadastra um produto no painel (`https://167-99-150-99.sslip.io/`, de
qualquer dispositivo) → aparece no catálogo público (GitHub Pages) na hora, pra qualquer pessoa.
Não precisa mais baixar `perfumes.js`, substituir arquivo, nem `git push` pra publicar um produto
novo. **Confirmado funcionando de ponta a ponta em 2026-08-17.**

**O que ainda precisa de `git push` + redeploy:** só mudanças de **código** (`server.js`,
`script.js`, `style.css`, etc.), não de produtos. `EDICAO/perfumes.js` continua no repo como
fallback (usado só se a API cair), mas não é mais editado no dia a dia — não se preocupe se ele
ficar desatualizado em relação ao `data/perfumes.json` do servidor.

`SISTEMA/script.js` busca os produtos em `API_PERFUMES` (uma URL **absoluta**, não relativa —
necessário porque o catálogo vive no GitHub Pages e o `BOT-SERVER` no Droplet, origens diferentes;
CORS liberado só nessa rota em `server.js`). Se o endereço do Droplet mudar um dia, atualizar essa
constante em `SISTEMA/script.js` e dar `git push`.

**Como atualizar o código no Droplet** (o `/root/whatsapp-bot-clicksim` de lá **não é um repositório
git** — foi implantado originalmente via `scp` manual): depois de dar `git push` nas mudanças de
código, entrar no Web Console do Droplet `clicksim-bot` (painel DigitalOcean → Droplets →
`clicksim-bot` → Web Console) e baixar os arquivos atualizados direto do GitHub, por exemplo:
```
cd /root/whatsapp-bot-clicksim
curl -sL -o server.js https://raw.githubusercontent.com/ClickSim/clicksim-catalogo/main/BOT-SERVER/server.js
pm2 restart clicksim-bot
```
Repetir pra cada arquivo que mudou (trocando o caminho). **Nunca** sobrescrever `auth/` ou `data/`
dessa forma — são a sessão do WhatsApp e os dados reais do cliente, não fazem parte do código.

## Publicando o site

Se for hospedar (Netlify, Hostinger etc.), suba a pasta `CLICK SIM` inteira mantendo essa
estrutura de subpastas — os caminhos entre `SISTEMA` e `EDICAO` são relativos e dependem disso.

**Atenção:** os nomes das pastas são propositalmente sem acento (`EDICAO`, não `EDIÇÃO`) porque
viram parte do endereço (URL) do site quando publicado, e acentos/cedilha em URL podem dar
problema dependendo do servidor. Mantenha assim nas próximas atualizações.

## Infraestrutura do Droplet clicksim-bot (167.99.150.99) — 2026-08-17

Conta DigitalOcean da consultoria. Tem 2 Droplets nessa conta — não confundir:
- `clicksim-bot` (167.99.150.99) — este projeto.
- `descomplique-delivery` (167.99.7.209) — projeto diferente, não mexer aqui por engano (os dois
  tinham nome genérico idêntico antes de serem renomeados).

No `clicksim-bot`: nginx instalado como proxy reverso (porta 443 para localhost:3000), certificado
Let's Encrypt para `167-99-150-99.sslip.io` (renova sozinho via certbot, timer systemd já vem
instalado por padrão). Firewall (ufw) libera 22, 80 e 443. Config do nginx em
`/etc/nginx/sites-available/clicksim-bot`. sslip.io é um serviço de DNS gratuito que resolve
`167-99-150-99.sslip.io` para o IP automaticamente, sem precisar configurar nada. Se um domínio de
verdade for configurado no lugar, trocar tanto o server_name do nginx quanto API_PERFUMES em
SISTEMA/script.js, e rodar certbot de novo.

## Acesso ao GitHub deste repositório (histórico — atualizado em 2026-08-17)

**Mudança de repositório em 2026-08-17:** o projeto migrou de `clicksim1/clicksimcatalogo` pra
**`ClickSim/clicksim-catalogo`**. Motivo: ninguém lembrava a senha da conta `clicksim1` (dona do
repositório antigo), e não dava pra confirmar se a conta `ClickSim` tinha permissão de escrita
nele. A conta `ClickSim` é dona do novo repositório, então tem acesso garantido, sem depender de
ninguém mais. **Efeito colateral: o link público do catálogo muda** — o antigo
(`clicksim1.github.io/clicksimcatalogo/...`) deixa de ser atualizado; o cliente precisa receber o
link novo depois que o GitHub Pages for habilitado no repositório novo (`Settings` → `Pages` →
Source: branch `main`, pasta `/ (root)`).

**Histórico do problema de acesso (repositório antigo):** esse repositório pertencia à conta GitHub
`clicksim1` mas também tinha commits da conta `ClickSim`, diferente da conta pessoal/da consultoria
(`Descompliqueconsultorias`) usada em outros projetos. O Gerenciador de Credenciais do Windows
guarda só **um** login por site (`git:https://github.com`), compartilhado entre todos os projetos
GitHub usados nesse computador — toda vez que se logava em outro projeto com
`Descompliqueconsultorias`, isso sobrescrevia o login salvo do Click Sim, e o próximo `git push`
falhava com erro 403. Isso ainda vale como risco pro repositório novo: evitar misturar login de
contas diferentes na mesma máquina sem um token dedicado.

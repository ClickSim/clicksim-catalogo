# Click Sim — estrutura do projeto

Esse projeto é a referência/template pra outras lojas — a ideia é replicar essa estrutura pra
cada novo cliente, trocando só o conteúdo (produtos, imagens, textos), mantendo o mesmo
esqueleto. Segue o padrão de organização usado nos catálogos/cardápios da consultoria:

- **SISTEMA/** — o site em si, o que o cliente final visita. Não precisa mexer aqui no dia a dia.
  - `index.html`, `style.css`, `script.js`
- **EDICAO/** — as fotos dos produtos e o catálogo original.
  - `imagens/` — fotos usadas no catálogo (o nome do arquivo é o que você digita no painel, sem "imagens/" na frente). Servida publicamente via GitHub Pages, em `https://clicksim.github.io/clicksim-catalogo/EDICAO/imagens/...`
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
  perfumes) e a API do catálogo (`/api/perfumes`), rodando 24h no Droplet DigitalOcean
  `clicksim-bot`. Ver `## Cadastro de perfumes (autonomia do cliente)` abaixo — já testado e
  funcionando de qualquer lugar, celular incluso.

## Checklist de verificação (se algo parecer errado)

Rode isso pra descobrir rápido onde está o problema, antes de sair mexendo:

```
# 1. Catálogo público está no ar?
curl -s -o /dev/null -w "Catalogo: HTTP %{http_code}\n" https://clicksim.github.io/clicksim-catalogo/SISTEMA/index.html

# 2. API de produtos responde e com quantos produtos?
curl -s https://167-99-150-99.sslip.io/api/perfumes | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).length,'produtos'))"

# 3. Painel exige login (401 sem, 200 com)?
curl -s -o /dev/null -w "sem login: %{http_code}\n" https://167-99-150-99.sslip.io/
curl -s -o /dev/null -w "com login: %{http_code}\n" -u clicksim:clicksim2026 https://167-99-150-99.sslip.io/

# 4. Servidor e bot de WhatsApp online? (precisa da chave SSH, ver seção de Infraestrutura)
ssh -i ~/.ssh/clicksim_droplet root@167.99.150.99 'pm2 list'

# 5. Auto-deploy funcionando (não está com o script vazio de novo)?
ssh -i ~/.ssh/clicksim_droplet root@167.99.150.99 'wc -l /root/whatsapp-bot-clicksim/auto-update.sh; tail -5 /root/whatsapp-bot-clicksim/auto-update.log'
```

Se `pm2 list` não rodar (chave SSH não autorizada/perdida): usar o Web Console pelo navegador —
painel DigitalOcean → Droplets → `clicksim-bot` → Console — e reautorizar uma chave nova (ver
seção "Acesso SSH direto" abaixo).

## Onde cada coisa roda hoje (atualizado em 2026-08-18)

- **Catálogo público (`SISTEMA/`)**: publicado via **GitHub Pages**, direto deste repositório
  (`ClickSim/clicksim-catalogo`) — link:
  `https://clicksim.github.io/clicksim-catalogo/SISTEMA/index.html`. Não depende de nenhum
  servidor ligado; atualiza sozinho (leva 1-2 min) a cada `git push` na branch `main`. O
  repositório antigo (`clicksim1/clicksimcatalogo`) está obsoleto, não é mais usado.
- **Painel (`BOT-SERVER`)**: roda de verdade no **Droplet DigitalOcean `clicksim-bot`**
  (`167.99.150.99`), gerenciado por PM2 (processo `clicksim-bot`), online 24h — **não** é só local
  (o `iniciar.vbs`/`PASSO_A_PASSO_INSTALACAO.md` descrevem um modo alternativo de rodar na sua
  própria máquina, mas o que está em produção é o Droplet). Acessível de qualquer lugar, celular
  incluso, em `https://167-99-150-99.sslip.io/` (login: ver `PAINEL_USUARIO`/`PAINEL_SENHA` em
  `server.js`). HTTPS via nginx + Let's Encrypt, domínio gratuito `sslip.io` (resolve sozinho pro
  IP do Droplet — não precisa configurar DNS). Esse Droplet também roda o bot de WhatsApp real do
  cliente, com sessão conectada e histórico reais — **nunca reiniciar/mexer na pasta `auth/` nem
  `data/` de lá sem cuidado**.

## Cadastro de perfumes (autonomia do cliente)

**Histórico do problema (resolvido em 2026-08-17):** o painel de cadastro salvava os produtos só
no `localStorage` do navegador de quem estava editando. Isso nunca chegava ao catálogo público de
verdade — só parecia funcionar quando o teste era feito no mesmo navegador/computador de quem
cadastrou. O cliente cadastrou produtos novos e o catálogo publicado não atualizou porque a
mudança nunca saiu do navegador dele. Isso **já tinha sido corrigido uma vez antes** (na entrega
ao cliente) mas a correção nunca foi commitada/enviada ao GitHub, então nunca foi publicada de
verdade — e o bug voltou. Por isso este arquivo existe: pra essa correção não se perder de novo.

**Como funciona agora:** o `BOT-SERVER/server.js` expõe uma API real:
- `GET /api/perfumes` — **pública, sem login**, com CORS liberado (o catálogo publicado em
  `SISTEMA/` busca os produtos daqui via `fetch`). Precisa ser pública pra qualquer visitante do
  site carregar sem senha.
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

**Fotos no painel** (`BOT-SERVER/public/app-perfumes.js`, constante `PASTA_IMAGENS`): apontam pra
`https://clicksim.github.io/clicksim-catalogo/EDICAO/imagens/` — o GitHub Pages, não o Droplet.
Corrigido em 2026-08-18 depois que o painel mostrou "Sem foto" em todos os produtos: a pasta
`EDICAO/imagens` nunca foi copiada pro Droplet (só o código do `BOT-SERVER` foi), então o caminho
antigo (`/EDICAO/imagens/`, relativo ao próprio Droplet) sempre dava 401/404 lá. Buscar do GitHub
Pages evita ter que manter uma cópia das imagens sincronizada nos dois lugares.

**Limite de tamanho de requisição** (`server.js`, `express.json({ limit: '50mb' })`): o padrão do
Express é só 100kb, muito pouco pra fotos em base64 anexadas no painel — causava
`PayloadTooLargeError` no log e o salvamento falhava sem aviso claro pro cliente. Corrigido em
2026-08-19.

**Fotos como arquivo real** (`server.js`, rota `POST /api/upload-imagem`; `app-perfumes.js`,
função `enviarFotoParaServidor`): quando o cliente avisou que ia cadastrar ~100 produtos com média
de 5 fotos cada, ficou claro que só aumentar o limite acima não seria suficiente/sustentável — cada
salvamento reenvia o catálogo inteiro, então fotos embutidas em base64 deixariam isso cada vez mais
pesado e lento. A correção definitiva: cada foto escolhida no painel é enviada na hora pro endpoint
de upload, que salva um arquivo real em `data/imagens-produtos/` e devolve uma URL pública
(servida com CORS liberado). O produto guarda só essa URL (texto curto), não mais a foto inteira.
`resolverImagem()` (painel e catálogo) trata 3 formatos: nome de arquivo (fotos antigas do seed,
resolve pro GitHub Pages), URL completa (`http...`, fotos novas), e `data:` (mantido só como
fallback de segurança, não deveria mais ocorrer em uso normal).

**Número de WhatsApp da loja** (usado nos links "Comprar" do catálogo) segue o mesmo padrão:
`GET /api/numero-whatsapp` (pública, CORS liberado) e `POST /api/config` (exige login, o painel
salva por aqui). Botão "Salvar número" no painel grava direto no servidor — sem baixar `config.js`
nem substituir arquivo manualmente.

**Botões removidos do painel** (2026-08-18, achados confusos/arriscados pelo cliente): "Restaurar
catálogo original" (resetava tudo pro seed original sem aviso claro — risco real de apagar
cadastros novos por engano), "Baixar config.js atualizado" e "Baixar perfumes.js atualizado"
(fluxo manual obsoleto). Adicionado no lugar: botão "🔄 Atualizar produtos" (recarrega a lista do
servidor, dá segurança visual de que salvou) e campo "Pesquisar produto" (filtra por nome/marca).

**Como atualizar o código no Droplet:** basta dar `git push` — existe auto-deploy configurado (ver
seção "Infraestrutura do Droplet" abaixo), chega sozinho em até 2 minutos. Só usar o método manual
via SSH/Web Console se o auto-deploy não estiver funcionando.

## Publicando o site

Se for hospedar (Netlify, Hostinger etc.), suba a pasta `CLICK SIM` inteira mantendo essa
estrutura de subpastas — os caminhos entre `SISTEMA` e `EDICAO` são relativos e dependem disso.

**Atenção:** os nomes das pastas são propositalmente sem acento (`EDICAO`, não `EDIÇÃO`) porque
viram parte do endereço (URL) do site quando publicado, e acentos/cedilha em URL podem dar
problema dependendo do servidor. Mantenha assim nas próximas atualizações.

## Infraestrutura do Droplet clicksim-bot (167.99.150.99)

Conta DigitalOcean da consultoria. Tem 2 Droplets nessa conta — não confundir:
- `clicksim-bot` (167.99.150.99) — este projeto.
- `descomplique-delivery` (167.99.7.209) — projeto diferente, não mexer aqui por engano (os dois
  tinham nome genérico idêntico antes de serem renomeados em 2026-08-17).

No `clicksim-bot`: nginx instalado como proxy reverso (porta 443 para localhost:3000), certificado
Let's Encrypt para `167-99-150-99.sslip.io` (renova sozinho via certbot, timer systemd já vem
instalado por padrão). Firewall (ufw) libera 22, 80 e 443. Config do nginx em
`/etc/nginx/sites-available/clicksim-bot`. sslip.io é um serviço de DNS gratuito que resolve
`167-99-150-99.sslip.io` para o IP automaticamente, sem precisar configurar nada. Se um domínio de
verdade for configurado no lugar, trocar tanto o server_name do nginx quanto `API_PERFUMES` em
`SISTEMA/script.js` e a constante `PASTA_IMAGENS` em `BOT-SERVER/public/app-perfumes.js`, e rodar
certbot de novo.

Existe também um domínio de verdade do cliente, `clicksimperfumes.com.br` — site profissional feito
por outro desenvolvedor, hospedado em outro lugar (fora do controle dessa consultoria, sem acesso).
Não tem relação com este projeto — decisão explícita: seguir publicando via GitHub Pages + Droplet
mesmo assim.

### Acesso SSH direto (configurado em 2026-08-18)

Existe uma chave SSH em `~/.ssh/clicksim_droplet` (no computador da consultoria) já autorizada em
`/root/.ssh/authorized_keys` no Droplet. Acesso direto, sem precisar do Web Console do navegador:
```
ssh -i ~/.ssh/clicksim_droplet root@167.99.150.99
```

### Auto-deploy (BOT-SERVER não é um repositório git no Droplet)

`/root/whatsapp-bot-clicksim` foi implantado via `scp` manual, não é git. Existe
`/root/whatsapp-bot-clicksim/auto-update.sh` + um cron (`*/2 * * * *`) que baixa os arquivos de
código do GitHub raw e reinicia o PM2 se algo mudou — um `git push` normal chega sozinho no
Droplet em até 2 minutos.

**Bug já visto**: colar um heredoc (`cat << 'SCRIPT'`) direto no Web Console do navegador pode
corromper a colagem (aparece um código de escape antes do comando) e criar o arquivo **vazio** —
o cron roda sem erro nem log, mas não faz nada, silenciosamente. Se o auto-update parecer que
parou, checar primeiro se o script não está vazio:
```
ssh -i ~/.ssh/clicksim_droplet root@167.99.150.99 'wc -l /root/whatsapp-bot-clicksim/auto-update.sh; tail /root/whatsapp-bot-clicksim/auto-update.log'
```
Recriar o script via SSH direto (não pelo Web Console) evita esse problema de colagem.

**Outro bug já visto**: o CDN do `raw.githubusercontent.com` pode manter cache desatualizado por
vários minutos no edge mais próximo do Droplet, mesmo já servindo a versão nova em outros lugares
(um `?query=cachebust` na URL não resolve, o CDN ignora). Se uma correção não chegar mesmo depois
de alguns minutos, bypassar o CDN mandando o arquivo direto por SSH:
```
curl -s "https://raw.githubusercontent.com/ClickSim/clicksim-catalogo/main/BOT-SERVER/server.js" | ssh -i ~/.ssh/clicksim_droplet root@167.99.150.99 'cat > /root/whatsapp-bot-clicksim/server.js && pm2 restart clicksim-bot'
```

**Nunca
sobrescrever `auth/` (sessão WhatsApp) nem `data/` (dados reais) nesse processo.**

## Acesso ao GitHub deste repositório (histórico)

**Mudança de repositório em 2026-08-17:** o projeto migrou de `clicksim1/clicksimcatalogo` pra
**`ClickSim/clicksim-catalogo`**. Motivo: ninguém lembrava a senha da conta `clicksim1` (dona do
repositório antigo), e não dava pra confirmar se a conta `ClickSim` tinha permissão de escrita
nele. A conta `ClickSim` é dona do novo repositório, então tem acesso garantido, sem depender de
ninguém mais. O link público do catálogo mudou junto — o antigo
(`clicksim1.github.io/clicksimcatalogo/...`) está obsoleto e parado.

**Histórico do problema de acesso (repositório antigo):** esse repositório pertencia à conta GitHub
`clicksim1` mas também tinha commits da conta `ClickSim`, diferente da conta pessoal/da consultoria
(`Descompliqueconsultorias`) usada em outros projetos. O Gerenciador de Credenciais do Windows
guarda só **um** login por site (`git:https://github.com`), compartilhado entre todos os projetos
GitHub usados nesse computador — toda vez que se logava em outro projeto com
`Descompliqueconsultorias`, isso sobrescrevia o login salvo do Click Sim, e o próximo `git push`
falhava com erro 403. Isso ainda vale como risco pro repositório novo: evitar misturar login de
contas diferentes na mesma máquina sem um token dedicado.

**Gotcha do template pra clientes novos**: `CLICK SIM/` é usado como molde copiado pra criar
projetos de outros clientes (ex: `LOJA DE EMBALAGENS/`, produtos de limpeza — nada a ver com
perfumes). Ao copiar a pasta inteira, o `.git` vem junto com o remote antigo grudado — descoberto
em 2026-08-17 que `LOJA DE EMBALAGENS/` estava apontando pro repositório do Click Sim (nunca
chegou a dar push, sem contaminação real, mas era risco real). Remote removido de lá. **Sempre
checar/trocar o `git remote` ao copiar esse template pra um cliente novo, antes de qualquer
commit/push.**

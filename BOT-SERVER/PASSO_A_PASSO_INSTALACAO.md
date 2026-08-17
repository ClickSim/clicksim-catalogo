# Atendente WhatsApp — Click Sim Perfumaria

Robô grátis que roda na sua própria máquina, sem usar nenhuma API paga.
Responde perguntas comuns dos clientes automaticamente e tem um painel web para você configurar tudo sem precisar mexer em código.

## 1. Instalar (só precisa fazer uma vez)

1. Dê duplo clique em **instalar.bat**
2. Aguarde a mensagem "Instalação concluída!" e aperte qualquer tecla para fechar

## 2. Abrir o atendente (uso do dia a dia)

1. Dê duplo clique em **iniciar.vbs**
2. Depois de alguns segundos, o navegador abre sozinho no painel de controle
3. Na primeira vez, vai aparecer um **QR Code** — escaneie com o **WhatsApp da loja** (não seu WhatsApp pessoal):
   - No celular: WhatsApp → Configurações (⚙️) → Aparelhos conectados → Conectar um aparelho
4. Pronto! O robô já está respondendo automaticamente

> Depois de conectado uma vez, não precisa escanear de novo — ele mantém a sessão salva mesmo se você reiniciar o computador.

## 3. Usando o painel

- **Controle**: liga/desliga as respostas automáticas e mostra se o servidor está online
- **Configurações da loja**: nome do atendente, link do catálogo, horário de atendimento
- **Adicionar mensagem**: cadastre ou edite mensagens — escolha o **tipo** (Saudação, Ausência, Resposta Rápida, etc.), as palavras-chave (só pra Resposta Rápida) e o texto da resposta
- **Mensagens cadastradas**: lista tudo que já foi cadastrado, com opção de editar/excluir. As mensagens de Saudação, Saudação Fora do Horário, Ausência e Fallback não podem ser excluídas (o bot sempre usa uma de cada) — só editadas
- **Histórico**: mostra as últimas conversas respondidas pelo robô

### O que o bot responde sozinho hoje

- 1ª mensagem do dia de um cliente → Saudação (dentro do horário) ou Saudação Fora do Horário
- Cliente escreve de novo fora do horário → Ausência (uma vez por dia)
- Pergunta batendo alguma palavra-chave cadastrada → Resposta Rápida correspondente
- Nada do que foi dito bate com nada → manda a mensagem de Fallback e passa a conversa pro atendente humano assumir pelo resto do dia (fica marcada com 🔴 no histórico)

**Follow-up** (cliente sumiu depois do catálogo) ainda **não é automático** — continua precisando do atendente mandar manualmente.

## 4. Desligar o atendente

No painel, dentro da seção "Conectado", clique em **Desligar atendente**.
(Se preferir, também dá pra fechar pelo Gerenciador de Tarefas do Windows procurando por `node.exe`)

## 5. Levar para outro computador

Basta copiar a pasta inteira `whatsapp-bot-clicksim` para o outro PC (o computador precisa ter o Node.js instalado — grátis em nodejs.org). Se copiar também a pasta `auth`, o WhatsApp continua conectado sem precisar escanear o QR de novo.

## Importante

- Este robô usa uma conexão **não oficial** com o WhatsApp (mesma técnica do WhatsApp Web). É gratuita e funciona bem para pequeno volume, mas não é o método oficial da Meta — evite disparar muitas mensagens em pouco tempo para reduzir o risco de bloqueio do número.
- Use o número oficial da loja, não um WhatsApp pessoal.

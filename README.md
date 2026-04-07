# 🍅 Meu Pomodoro

Ferramenta Pomodoro personalizada para desenvolvedores — com sincronização de histórico entre dispositivos, via Railway.

## Funcionalidades

- ⏱ **3 ciclos de foco:** Clássico (25/5), Engenharia (50/10), Ultradiano (90/20)
- 🌀 **Timer visual** com anel SVG animado e cor dinâmica por modo
- ⏳ **Buffer de +5 min** para não interromper o raciocínio no meio de um debug
- 💡 **Sugestões de pausa** em 5 categorias (Físico, Criativo, Reflexão, Organização, Visual)
- 🔔 **Alertas configuráveis:** gradual, carrilhão, sino ou silencioso (visual)
- 📊 **Histórico de sessões** com estatísticas e gráfico de barras
- 🔄 **Sync entre dispositivos** via Sync Code anônimo (sem cadastro)
- 📵 **Modo offline** — sessões são salvas localmente e sincronizadas quando a conexão volta

## Stack

| Camada | Tecnologia |
|---|---|
| Servidor | Node.js + Express |
| Banco | PostgreSQL (Railway Plugin) |
| Frontend | HTML + CSS Vanilla + JS (ES Modules) |

## Rodar localmente

```bash
# 1. Instale as dependências
npm install

# 2. Configure o banco
cp .env.example .env
# Edite .env com sua DATABASE_URL local

# 3. Crie as tabelas
npm run migrate

# 4. Inicie o servidor
npm run dev
# → http://localhost:3000
```

## Deploy no Railway

1. Suba o repositório no GitHub
2. Crie um novo projeto no [Railway](https://railway.app)
3. Adicione o plugin **PostgreSQL**
4. A variável `DATABASE_URL` é injetada automaticamente
5. Na aba **Deploy**, configure a variável `NODE_ENV=production`
6. Após o primeiro deploy, rode a migration via Railway CLI:
   ```bash
   railway run npm run migrate
   ```

## Estrutura do projeto

```
Pomodoro/
├── server/           # Backend (Express + PostgreSQL)
│   ├── index.js
│   ├── db.js
│   ├── migrate.js
│   └── routes/
│       ├── sync.js
│       ├── sessions.js
│       └── settings-route.js
├── public/           # Frontend estático
│   ├── index.html
│   ├── css/
│   └── js/
├── package.json
├── railway.json
└── .env.example
```

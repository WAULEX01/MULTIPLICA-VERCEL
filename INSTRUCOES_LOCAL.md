# Como visualizar o Multiplica PLUS localmente

## Requisitos

- Node.js 20 ou superior;
- pelo menos 5 GB livres no disco durante a instalação;
- projeto extraído fora do OneDrive, preferencialmente em `C:\Projetos\multiplica-plus`.

## Windows

Abra o terminal dentro da pasta `codigo-fonte` e execute:

```bat
npm install
npm run dev
```

Depois acesse `http://localhost:5173`.

O modo local não encaminha dados para o banco oficial. O Service Worker/PWA também é desativado automaticamente em `localhost`, evitando a tela branca causada por cache antigo.

Para encerrar o servidor, volte ao terminal e pressione `Ctrl + C`.

## Produção

Não habilite conexão com a API de produção para simples visualização. Antes de qualquer publicação, faça backup dos arquivos atuais e do banco MySQL.

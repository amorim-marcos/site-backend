# Berneck Headless CMS API

Este software entrega uma API de conteúdo usando Strapi para o website da Berneck.

## Dependências

Este software foi construído usando a versão LTS 14 do Node.js.

O Headless CMS utilizado foi o Strapi 3, conectando com banco MySQL.

## Instalação

- Clone o repositório git em uma pasta desejada e navegue até a pasta clonada.
- Na raiz, rode o comando `npm install` para instalar as dependências
- Crie uma cópia do arquivo `.env.example` como `.env` para habilitar o carregamento de variáveis de ambiente. Siga as etapas da seção de configuração para configurá-las.

## Configuração

#### Ambiente 

- Definida a variável `NODE_ENV` em `.env`. Use `development` para ambiente de desenvolvimento e `production` para ambiente de produção;
- É possível trocar o host e a porta de execução alterando os valores de `HOST` e `PORT` no `.env`;

#### Conexão com o banco de dados

Para configurar o banco de dados, defina as váriaveis associadas em seu arquivo `.env`:

- `DATABASE_HOST`: Endereço host onde está hospedado o banco de dados mysql utilizado.
- `DATABASE_PORT`: Porta de escuta do banco mysql.
- `DATABASE_NAME`: nome do banco de dados onde ocorrerão as operações da aplicação.
- `DATABASE_USERNAME`: Usuário de acesso do seu banco mysql.
- `DATABASE_PASSWORD`: Senha de acesso associada ao seu mysql.

#### Migração dos dados

É essencial que seja compartilhada a mesma versão de bancos de dados nos diferentes ambientes. Isto é alcançado realizando migrações dos dados de conteúdo, e também salvando as diversas configurações (ver seção Configurações Padrões). Do resto o Strapi cuida.

##### Rodar uma migração 

Para rodar apenas uma migração, rode:

```
npm run migrate:up
```

##### Rodando todas as migrações

Para rodar apenas todas as migrações faltantes, rode:

```
npm run migrate:all
```

##### Retornando de uma migração

Para desfazer apenas uma migração, rode:

```
npm run migrate:down
```

##### Retornando todas as migrações

Para desfazer todas migrações, rode:

```
npm run migrate:down
```

##### Criando um arquivo de migração

Para criar um arquivo de migração, rode:

```
npm run migrate:make {nome da migração}
```

Isto criará um arquivo baseado no stub `migrations/stubs/content.stub.js`, que é considerado o padrão. Há ainda alguns stubs extras para facilitar a criação:

- `component.stub.js`: cria um template para criar uma tabela que possui dados de componente Strapi.
- `content_component_rel.stub.js`: cria um template para criar uma tabela que contém a relação entre um conteúdo Strapi e um componente Strapi. 
- `rel.stub.js`: cria um template para criar uma tabela que contém uma relação 1xN ou NxN entre conteúdos Strapi. 

Para criar um arquivo baseado em um destes outros stubs, basta passar ele como parâmetro:

```
npm run migrate:make {nome da migração} -- --stub migrations/stubs/{arquivo de stub}
```

##### Preenchendo o banco de dados com dados de teste

Foram criados *seeders* para inclusão mais facilitada de dados locais. Para preencher o banco com novos dados, rode

```
npx knex seed:run
```

**Nota**: Evite rodar esse comando em produção. 

#### Configurações padrões

O Strapi salva algumas configurações que seriam diretamente no banco de dados que são importantes de serem compartilhadas entre ambientes. Para facilitar o compartilhamento destas configurações entre ambientes, criamos um script que realiza o *dump* e o *restore* dessas configurações.

##### Configurações possíveis de serem salvas

- Papéis e permissões de usuários administrativos;
- Papéis e permissões de usuários da API (ex: consumo dos endpoints);
- Locales disponíveis

##### Salvando configurações

Para salvar as configurações padrões, rode o comando `npm run complete-config:dump`. Esse arquivo gerará um conjunto de arquivos `.json` no diretório `migrations/`. Para manter essas configurações comuns ao projeto, adicione esses arquivos `.json` ao versionamento de código. 

##### Restaurando as configurações

O processo de restaurar as configurações permite que uma configuração salva em um arquivo `.json` seja recarregada no banco de dados. Para realizar uma restauração de configuração, rode o comando `npm run complete-config:restore`. Por serem consideradas configurações que devem ser compartilhadas independentemente do ambiente, **as tabelas serão totalmente rescritas**. Por isso, sempre garanta que alterações em dados feitas pelo painel sempre estejam versionadas nos arquivos `.json` de configuração.

## Execução

### Desenvolvimento

Há dois modos de execução principais de desenvolvimento.

O primeiro, com o comando padrão `npm run develop`, envolve sempre rodar as migrações por completo antes do comando `strapi develop`. Assim, garante-se que as tabelas estão atualizadas devidamente no branch antes de rodar o desenvolvimento.

O segundo, é ignorar o migrate da tabela, rodando o comando `npm run develop:nomigrate`.

### Produção

Para executar em produção, configure o arquivo `.env` devidamente, setando `NODE_ENV` como `production`. Após, faça o build do painel administrativo com `npm run build`. Por fim, inicie a aplicação com `npm start`. 

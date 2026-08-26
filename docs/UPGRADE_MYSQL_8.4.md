# Plano de Upgrade — MySQL 8.0 → 8.4 (RDS)

**Status:** levantamento concluído, execução não iniciada
**Branch:** `sb-154-upgrade-mysql8`
**Base da auditoria:** `deaa5b2` (idêntica a `prd`)
**Última atualização:** 2026-08-21
**Região / perfil:** `eu-west-3` (Paris) / `mp-coinov-eu`
**Versão navegável:** https://claude.ai/code/artifact/dbc0cafd-4abb-4c3f-a11c-613f3bc6d393

---

## 1. Por que

As duas instâncias RDS estão em **Amazon RDS Extended Support pago** desde 01/08/2026, quando o MySQL 8.0 atingiu o fim do suporte padrão no RDS.

| Instância | Versão | Classe | Parameter group | Extended Support | Backup | Público |
|---|---|---|---|---|---|---|
| `bnk-db-site-dev-eu-west-3` | 8.0.44 | db.t3.medium | `default.mysql8.0` | Ativo (pago) | 7 dias | Não |
| `bnk-db-site-prd-eu-west-3` | 8.0.45 | db.t3.medium | `default.mysql8.0` | Ativo (pago) | 7 dias | Não |

Conta `635044002483`, região `eu-west-3`, perfil `mp-coinov-eu`. Janela de manutenção: quinta 03:06–03:36 UTC (00:06 BRT) nas duas.

**Endpoints** (não são publicamente acessíveis — exigem túnel SSH pela EC2):

```
bnk-db-site-dev-eu-west-3.cvtrpbjmzydv.eu-west-3.rds.amazonaws.com
bnk-db-site-prd-eu-west-3.cvtrpbjmzydv.eu-west-3.rds.amazonaws.com
```

### Upgrade automático de minor agendado na dev

```
Action: db-upgrade
CurrentApplyDate: 2026-08-27T03:06:00+00:00
Description: Automatic minor version upgrade to mysql 8.0.45
```

**Decisão: deixar acontecer.** Depois de 27/08 as duas instâncias ficam em 8.0.45, e o ensaio na dev passa a percorrer exatamente o mesmo caminho da prd (`8.0.45 → 8.4.10`), aumentando a fidelidade do passo 4 sem custo. A prd não tem `db-upgrade` pendente, apenas patch de SO.

Somadas são **4 vCPU em cobrança por vCPU-hora** — ordem de grandeza de **~US$ 290/mês** (confirmar o valor exato de eu-west-3 na fatura).

Ambas estão Single-AZ, com `AutoMinorVersionUpgrade` ligado.

> **Nota:** o único minor 8.0 elegível ao Extended Support é o `8.0.46-RDS.20260624`, que a AWS gera com correções de CVE. Estando em 8.0.44/8.0.45, paga-se pelo Extended Support sem estar na versão que ele entrega.

### Linha do tempo

| Marco | MySQL 8.0 | MySQL 8.4 |
|---|---|---|
| Fim do suporte padrão RDS | 31/07/2026 *(passou)* | 31/07/2029 |
| Início da cobrança de Extended Support | 01/08/2026 | 01/08/2029 |
| Parede final | 31/07/2029 | 31/07/2032 |

---

## 2. Decisão

**Subir para MySQL 8.4 mantendo o driver `mysql` v2, com parameter group custom habilitando `mysql_native_password`.**

É a opção de menor risco e menor custo. A auditoria não encontrou nenhum bloqueador de schema, palavra reservada ou SQL incompatível.

**É uma ponte, não uma solução definitiva.** Compra suporte padrão gratuito até 31/07/2029 e adia a parede final para 2032 — tempo para fazer o upgrade do Strapi, que é o conserto real (ver seção 7).

---

## 3. Auditoria do código

### Exige ação

- **Driver sem `caching_sha2_password`** — `mysql` v2.18.1; o `node_modules/mysql/lib/protocol/Auth.js` implementa exclusivamente `mysql_native_password`. Sem manutenção desde 2020.
- **Parameter group imutável** — `default.mysql8.0` é padrão da AWS e não aceita alteração. Um custom precisa existir antes do upgrade.
- **Dockerfile de teste usa flag removida** — `test/helpers/db-test/Dockerfile` usa `--default-authentication-plugin`, que não existe no 8.4.
- **Ambiente local de banco quebrado** — o mesmo Dockerfile faz `COPY ./testdump.sql`, mas o arquivo não existe e está coberto pelo `.gitignore` (`*.sql`). O build falha hoje.

### Verificado, sem impacto

- Palavras reservadas novas do 8.4 — nenhuma colisão em tabelas ou colunas
- `AUTO_INCREMENT` em FLOAT/DOUBLE — todas as migrations usam `table.increments('id')`
- FKs sobre chave não-única — todas referenciam `id`, que é primary key
- Sintaxe `MASTER`/`SLAVE` — zero ocorrências
- SQL cru — apenas `SET FOREIGN_KEY_CHECKS`, válido no 8.4
- TLS e ciphers fracos — a conexão não usa SSL

### Por que não trocar para `mysql2` nesta janela

O `knex` 0.21.18 tem dialeto `mysql2` e o `strapi-connector-bookshelf` aceita a string na whitelist, o que faz a troca *parecer* um flip de config. Não é — três `switch (client)` do conector casam apenas com `'mysql'`:

| Arquivo do conector | O que deixa de rodar | Efeito |
|---|---|---|
| `knex.js:118` | O `typeCast` customizado | `TINY(1)` para de virar boolean (volta `0`/`1`) e `DECIMAL` volta como string — **silenciosamente, em toda a API** |
| `queries.js:758` | A busca `_q` do Strapi | Nenhum `case` casa; a query sai sem filtro. Afeta a busca do painel admin |
| `mount-models.js:32` | Nada — cai no `default:` | Sem impacto |

Nenhum desses erros é lançado em runtime.

---

## 4. Execução — seis passos, ~8–10h

Ordenados do mais barato ao mais caro de errar.

### Passo 1 — Container 8.4 local *(1–2h)* — **ambiente pronto em 2026-08-21**

Existe por **reversibilidade**: upgrade de RDS não tem downgrade. Se a dev subir para 8.4 e quebrar, o caminho de volta é restaurar snapshot num instance novo. Um container é destruir e recriar em segundos.

Responde a hipótese central do plano: *o driver `mysql` v2 conecta no 8.4 e a aplicação sobe?*

```yaml
# docker-compose-db.yml — um serviço, não uma matriz
services:
  db84:
    image: mysql:8.4.10          # alvo definido — NAO usar a tag flutuante mysql:8.4
    ports: ["3307:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: passwordtest
      MYSQL_DATABASE: berneck
    command: ["mysqld", "--mysql-native-password=ON"]
```

```sql
CREATE USER 'dev'@'%' IDENTIFIED WITH mysql_native_password BY '<senha>';
GRANT ALL PRIVILEGES ON berneck.* TO 'dev'@'%';
```

Subir o Strapi sem editar o `.env` — o `dotenv` não sobrescreve variáveis já presentes no ambiente:

```bash
DATABASE_PORT=3307 DATABASE_HOST=127.0.0.1 yarn develop
```

As migrations rodando contra base nova vêm junto, de graça.

**✅ PASSO 1 CONCLUÍDO — 2026-08-21.** Container `mysql:8.4.10`, plugin `mysql_native_password` ACTIVE, usuário `dev@%` criado nesse plugin.

Resultados dos testes:

| Verificação | Resultado |
|---|---|
| Driver `mysql` 2.18.1 autentica no 8.4.10 | ✅ conectou como `dev@%` |
| `TINYINT(1)` → `boolean` | ✅ `true` / `false` |
| `DECIMAL` → `number` | ✅ `12.5` / `-3.75` |
| `INT` → `number` | ✅ `42` |

**A hipótese central do plano está confirmada:** o driver sem manutenção desde 2020 fala com o MySQL 8.4, e o `typeCast` do conector se mantém.

O Strapi não foi iniciado localmente porque o `yarn` aplica `engines` de forma estrita (`<=14.x.x`) e o Node 14 não tem build `darwin-arm64` — rodaria sob Rosetta, exigindo recompilar os módulos nativos. Os testes foram feitos direto contra o driver, que é **JavaScript puro**: o handshake de autenticação e o `typeCast` são idênticos em qualquer versão de Node. A validação da aplicação completa em Node 14 real acontece no **passo 4**, no servidor.

> **Armadilha encontrada:** a tag flutuante `mysql:8.4` resolve para **8.4.11**. Além de não ser o alvo escolhido, a layer dessa tag corrompeu no cache local durante um incidente de disco cheio (o `docker-entrypoint.sh` ficou com 0 bytes, causando `exec format error`) e não se recupera com `rmi` + `prune` + pull. Sempre fixar o minor explicitamente.

### Passo 2 — Verificar os plugins de autenticação *(0,5h)* — ✅ **CONCLUÍDO 2026-08-21**

Resultado na `bnk-db-site-dev-eu-west-3` (versão `8.0.44`):

| user | host | plugin |
|---|---|---|
| `rdsadmin` | localhost | `auth_socket` |
| `mysql.infoschema` | localhost | `caching_sha2_password` |
| `mysql.sys` | localhost | `caching_sha2_password` |
| **`admin`** | `%` | **`mysql_native_password`** |
| `rds_superuser_role` | `%` | `mysql_native_password` |

**A aplicação conecta como `admin`, o usuário master do RDS** — não existe usuário dedicado (`dev` é apenas a configuração local de desenvolvimento). Como `admin` está em `mysql_native_password`, **o passo 3 é obrigatório**: sem ele o Strapi para de autenticar após o upgrade. Os dois usuários em `caching_sha2_password` são contas internas do MySQL, acessadas por socket local.

**Também confirmado:** `@@innodb_adaptive_hash_index = 1` (ligado). Ver a decisão revisada no passo 3: não será sobreposto.

**Observação fora do escopo deste upgrade:** a aplicação usar a conta master do RDS é um desvio de menor privilégio. Vale registrar como item separado de segurança, não como parte desta migração.

#### Acesso ao banco

As instâncias não são públicas (`PubliclyAccessible: False`). A VPN resolve o DNS e roteia (`10.0.0.0/8` → túnel), mas a porta 3306 dá **timeout** — o Security Group libera a origem da EC2, não a faixa da VPN. O caminho que funciona é **túnel SSH pela EC2**:

```bash
ssh -f -N -L 13306:bnk-db-site-dev-eu-west-3.cvtrpbjmzydv.eu-west-3.rds.amazonaws.com:3306 admin@<host-ec2>
```

No DBeaver, aba **SSH** → *Use SSH Tunnel* (host da EC2, usuário `admin`, chave privada), mantendo o endpoint do RDS na aba Main.

### Passo 3 — Parameter group custom *(1h)*

Família `mysql8.4`, com `mysql_native_password = ON` (parâmetro estático, exige reboot). Pré-requisito inegociável — sem ele a aplicação não conecta após o upgrade.

**Decisão revisada (2026-08-21): não sobrepor o `innodb_adaptive_hash_index`.** A justificativa inicial (preservar o comportamento do 8.0 para isolar variáveis) não se sustentou por dois motivos: não há medição de performance no escopo, então não haveria com o que comparar; e o parâmetro é **dinâmico**, ajustável em produção sem reboot, o que torna o custo de errar praticamente nulo. O 8.4 desligou por padrão após evidência de contenção de latch, e sobrepor um default do fornecedor exigiria justificativa positiva.

Fica como observação: está ligado hoje (`@@innodb_adaptive_hash_index = 1`, verificado), o 8.4 usa `OFF`, e é o primeiro lugar a investigar se aparecer degradação depois do upgrade.

Contexto do parâmetro: É a maior fonte de delta de performance entre as versões, e é uma escolha de configuração sob controle de vocês — não um risco a descobrir. O 8.4 desligou por bons motivos (contenção), então manter ligado não é automaticamente certo; o que não pode é ninguém ter olhado.

### Passo 4 — Upgrade da dev e validação *(2–3h)* — **em andamento desde 2026-08-21**

**Upgrade executado pela infra em 2026-08-21.** Confirmado:

| Item | Valor |
|---|---|
| Versão | `8.4.10` |
| Parameter group | `bnk-site-mysql84` |
| Status dos parâmetros | `in-sync` |

O Strapi sobe e conecta. Confirmado por SQL na instância: `VERSION()` = `8.4.10`, plugin `mysql_native_password` = `ACTIVE`, usuário `admin@%` = `mysql_native_password`. O upgrade funcionou pelo mecanismo especificado, não por acaso.

Seções 1 a 5 do checklist concluídas. Seção 6 (frontend) pendente.

**Seção 4 (admin), 2026-08-26:** editar e salvar ambiente, upload de imagem de galeria e busca do admin (o `_q`) funcionando.

**Seção 5 (integrações), 2026-08-26:** requisições em `200` com latência de 14 a 100 ms, sem degradação. Uma ocorrência de `bootstrap function in admin failed / CustomError: No Rows Updated` no restart das 17:55. **Investigado e descartado como bloqueador:**

- Ocorrência única em 21 MB de log
- Dos 5 `strapi start` registrados no arquivo, só esse falhou
- `pm2 restart backend` **não reproduziu** o erro
- Processo estável: `restarts: 0`, `unstable restarts: 0`
- `/var/www/html/backend` foi modificado no mesmo minuto, indicando que era um **deploy** e não um restart simples

**Seção 2 validada por comparação direta entre ambientes.** Como a produção ainda está em 8.0.45, foi possível rodar o diff 8.0 contra 8.4 que havia sido cortado do escopo, agora com dados reais:

| Campo | dev (8.4.10) | prd (8.0.45) |
|---|---|---|
| `is_highlighted` | `bool` | `bool` |
| `inauguration_soon` | `bool` | `bool` |
| `emphasis` | todos null | todos null |
| `carbon_sequestration` | `float` | `float` |
| `atmospheric_emissions` | `float` | `float` |
| `in_ambients` (griseo-grann) | 2 ambientes | 2 ambientes |

Nenhuma divergência de tipo. O `typeCast` do conector se comporta igual nas duas versões.

**Achado não relacionado ao upgrade:** o `findOne` de produtos calcula anterior/próximo com `findIndex`, e quando o produto não é encontrado na lista o `-1` faz o cálculo devolver o primeiro e o último produto silenciosamente. Ocorre ao chamar a rota sem `_locale`, e o comportamento é idêntico nas duas versões. Merece item próprio.

Validação funcional em andamento: ver [`CHECKLIST_VALIDACAO_MYSQL_8.4.md`](./CHECKLIST_VALIDACAO_MYSQL_8.4.md).

> Este passo **é** a validação de QAS — "QAS" e "dev" são o mesmo ambiente. As decisões de janela de manutenção e de tempo de vida do ambiente azul dependem da conclusão deste passo.

A validação real: RDS de verdade, build da AWS, schema de verdade, aplicação de verdade — mais fiel que qualquer container.

Navegar site e painel admin com atenção, conferindo:

- [ ] Strapi sobe e conecta sem erro de autenticação
- [ ] Login no painel admin
- [ ] Listagem e edição de conteúdo
- [ ] Campos booleanos retornam `true`/`false`, não `0`/`1`
- [ ] Campos decimais retornam número, não string
- [ ] Busca do painel admin
- [ ] Upload de mídia
- [ ] Sincronia com o Meilisearch continua indexando

Sai do Extended Support e já corta metade do custo mensal.

### Passo 5 — Produção via Blue/Green *(2–3h)*

Único pré-requisito no RDS MySQL: **backups automáticos habilitados** — ✅ confirmado, 7 dias de retenção nas duas instâncias. O parameter group e a versão-alvo entram na própria criação:

```bash
aws rds create-blue-green-deployment \
  --source <arn-da-prd> \
  --target-engine-version 8.4.10 \
  --target-db-parameter-group-name <pg-custom>
```

Aguardar o `Replica_Lag` perto de zero e fazer o switchover (tipicamente ≤ 5s de downtime).

> **Específico do `db.t3.medium`:** a inicialização de storage do Blue/Green não está disponível para as famílias t3 e t4. A instância verde carrega blocos por *lazy loading*, puxando do S3 sob demanda — então **a performance pode estar degradada nos primeiros minutos após o switchover**. Não fazer o switchover em horário de pico, e não confundir essa lentidão inicial com problema do 8.4 e reverter sem necessidade.

### Passo 6 — Encerrar o Extended Support *(0,5h)*

Com as duas instâncias no 8.4, a cobrança por vCPU-hora cessa. Confirmar na fatura do mês seguinte.

### Rollback

Enquanto o Blue/Green existe, o ambiente azul (8.0) permanece intacto — é o rollback imediato, e melhor que qualquer suíte de testes.

**Manter o azul vivo por alguns dias** após o switchover, em vez de deletar na hora: custa algumas diárias de instância e compra uma janela real de rollback, caso uma regressão sutil só apareça quando alguém abrir uma página menos visitada.

---

## 5. Escopo deliberadamente cortado

| Item | Por que saiu |
|---|---|
| Container 8.0 de baseline | Já existe um MySQL 8.0 funcionando — o local e a própria dev |
| Matriz de testes `test:matrix` | Serve para dar amplitude, e amplitude é o que a instância dev entrega melhor |
| `testdump.sql` | Só era necessário para os containers que saíram |
| `mysqlsh` local | O RDS roda os próprios prechecks e **recusa** o upgrade se houver bloqueador de schema — não corrompe |

### Testes automatizados — adiados

Decisão de **momento, não de valor**. O container responde a mesma pergunta em menos tempo.

O que justifica construí-los depois é a **migração para `mysql2`**, onde as quebras são silenciosas (ver seção 3). Desenho registrado para quando chegar a hora:

```js
// test/db-contract.test.js — para o projeto de migração do Strapi
it("TINYINT(1) volta como boolean e DECIMAL como number", async () => {
  const knex = strapi.connections.default;
  await knex.raw("CREATE TEMPORARY TABLE t_types (b TINYINT(1), d DECIMAL(10,2))");
  await knex.raw("INSERT INTO t_types VALUES (1, 12.50)");
  const [rows] = await knex.raw("SELECT b, d FROM t_types");

  expect(rows[0].b).to.be.a("boolean");
  expect(rows[0].d).to.be.a("number");
});
```

Hoje a suíte roda em **sqlite** (`config/env/test/database.json`) e cobre apenas boot e dump/restore de config. Quando for construída, o sqlite precisa sair — testar em sqlite o que roda em MySQL foi o que criou a falsa sensação de cobertura.

---

## 6. Itens abertos

- [x] ~~**Onde vive o banco de QAS**~~ — **resolvido (2026-08-21):** "QAS" refere-se ao ambiente **dev na AWS** (`bnk-db-site-dev-eu-west-3`). Não há terceira instância. O **passo 4 é a validação de QAS**.
- [x] ~~**Plugins de autenticação**~~ — **resolvido (2026-08-21):** a app conecta como `admin`, em `mysql_native_password`. Passo 3 confirmado como obrigatório.
- [x] ~~**Manutenções pendentes e retenção de backup**~~ — **resolvido (2026-08-21):** retenção de **7 dias** nas duas instâncias, então o pré-requisito do Blue/Green está satisfeito. Pendente na dev: upgrade automático de minor para 8.0.45 em 27/08 (decidido deixar acontecer).
- [x] ~~**Minor 8.4 alvo**~~ — **resolvido (2026-08-21): `8.4.10`.** O RDS oferece de 8.4.3 a 8.4.11 como alvo a partir de 8.0.45; a escolha é nossa via `--target-engine-version`. Com `AutoMinorVersionUpgrade: True`, o RDS avança os minors sozinho depois — o minor inicial é ponto de partida, não decisão duradoura.
- [ ] ⚠️ **Permissões IAM para executar o upgrade** — o usuário `mamorin.ext` tem *explicit deny* em `ec2:DescribeSecurityGroups` pela policy `zDevelop_Coinov`. **Verificar antes de agendar qualquer janela** se há permissão para: `rds:CreateDBParameterGroup`, `rds:ModifyDBParameterGroup`, `rds:ModifyDBInstance`, `rds:CreateBlueGreenDeployment`, `rds:SwitchoverBlueGreenDeployment`. Sem elas, os passos 3 a 6 dependem de outra pessoa — é um bloqueador de execução, não técnico.
- [x] ~~**Acesso ao banco**~~ — **resolvido (2026-08-21):** túnel SSH pela EC2. A VPN resolve DNS e roteia, mas a porta 3306 dá timeout — o Security Group filtra por origem.
- [ ] **Valor real da cobrança de Extended Support** na fatura de agosto

---

## 7. O débito de 2029

O MySQL é o componente com prazo mais folgado da stack. Estes continuam vencidos depois do upgrade:

| Componente | Versão | Situação |
|---|---|---|
| Node.js | 14 | EOL desde abril/2023 |
| Strapi | 3.6.8 | EOL |
| knex | 0.21.18 | Sem manutenção |
| driver mysql | 2.18.1 | Sem manutenção desde 2020 |

No **MySQL 9.x o `mysql_native_password` foi removido do servidor** — não há parâmetro que o traga de volta. A próxima major encontra uma parede sólida. Ligar o plugin no 8.4 também significa assumir conscientemente autenticação baseada em SHA1 por mais alguns anos.

**Estimativa do conserto real (Strapi 3 → 4/5 + `mysql2` + Node moderno):** 4 a 8 semanas com uso intenso de IA, contra 6 a 12 sem — **baixa confiança**. São 39 content types, ~20 componentes, dois plugins próprios (`products-sort`, `ambients-sort`) e o frontend, que consome a API e precisa acompanhar a mudança do envelope de resposta. O que pode estourar o prazo são os plugins de terceiros (`strapi-plugin-meilisearch`, `ckeditor5`). Merece levantamento próprio antes de virar compromisso com data.

Registrar como item de backlog **com prazo**, não como "algum dia". A janela 2026–2029 é confortável para fazer sem pressa.

---

## Referências

- [MySQL on Amazon RDS versions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/MySQL.Concepts.VersionMgmt.html) — datas de suporte e minors elegíveis
- [Best practices for upgrading RDS for MySQL 8.0 to 8.4](https://aws.amazon.com/blogs/database/best-practices-for-upgrading-amazon-rds-for-mysql-8-0-to-8-4-with-prechecks-blue-green-and-rollback/)
- [Upgrade strategies for Amazon RDS for MySQL 8.0 to 8.4](https://aws.amazon.com/blogs/database/upgrade-strategies-for-amazon-rds-for-mysql-8-0-to-8-4/)
- [Creating a blue/green deployment](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-creating.html) — pré-requisitos
- [What Is New in MySQL 8.4 since MySQL 8.0](https://dev.mysql.com/doc/refman/8.4/en/mysql-nutshell.html)
- [Amazon RDS Extended Support](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support.html)

# Upgrade MySQL 8.0 para 8.4 - site Berneck

Duas instâncias RDS do site precisam subir de MySQL 8.0 para **8.4.10**. Estão em Extended Support pago desde 01/08/2026 (cerca de US$ 290/mês); o 8.4 tem suporte padrão gratuito até 31/07/2029.

| Instância | Versão atual |
|---|---|
| `bnk-db-site-dev-eu-west-3` | 8.0.44 |
| `bnk-db-site-prd-eu-west-3` | 8.0.45 |

Conta `635044002483`, região `eu-west-3`.

O método do upgrade fica a critério de vocês. Este documento cobre apenas o que a aplicação exige para continuar funcionando depois dele.

---

## Requisito crítico

A aplicação usa um driver MySQL antigo que só fala `mysql_native_password`. O usuário `admin` do banco autentica por esse plugin.

**No MySQL 8.4 esse plugin vem desligado por padrão.**

Se as instâncias subirem para 8.4 com o parameter group padrão (`default.mysql8.4`), a aplicação para de autenticar e o site sai do ar.

O `default.mysql8.0` em uso hoje não é editável, então será necessário criar um parameter group custom da família `mysql8.4`.

---

## Parâmetro exigido

| Parâmetro | Valor | Por quê |
|---|---|---|
| `mysql_native_password` | `ON` | Sem isso a aplicação não conecta. É parâmetro estático, exige reboot. **Não remover em limpezas futuras.** |

Os demais parâmetros podem ficar no default do 8.4.

Sugestão de comandos:

```bash
aws rds create-db-parameter-group --region eu-west-3 \
  --db-parameter-group-name bnk-site-mysql84 \
  --db-parameter-group-family mysql8.4 \
  --description "Site Berneck - MySQL 8.4"

aws rds modify-db-parameter-group --region eu-west-3 \
  --db-parameter-group-name bnk-site-mysql84 \
  --parameters "ParameterName=mysql_native_password,ParameterValue=ON,ApplyMethod=pending-reboot"
```

O nome do grupo é sugestão. Criar o grupo não afeta nenhuma instância; ele só passa a valer quando associado.

---

## O parameter group precisa ser informado no comando de upgrade

Criar o grupo não basta. Se ele não for passado no comando que sobe a versão, o RDS atribui o `default.mysql8.4` e a aplicação cai quando a instância volta.

Associar depois também não resolve: o `mysql_native_password` é estático e só passa a valer no reboot seguinte, deixando a aplicação sem autenticar nesse intervalo.

| Método | Parâmetro |
|---|---|
| `modify-db-instance` | `--db-parameter-group-name` |
| `create-blue-green-deployment` | `--target-db-parameter-group-name` |

---

## Versão-alvo: 8.4.10

O RDS oferece de 8.4.3 a 8.4.11 como alvo. Escolhemos 8.4.10 e validamos a aplicação contra essa versão. Se houver motivo para usar outra, avisem antes.

---

## Sequência exigida

**1. Dev primeiro.**

**2. Validação nossa.** Assim que a dev estiver no 8.4, avisem quem enviou este documento. Precisamos subir a aplicação e conferir autenticação, conteúdo e integrações. Leva algumas horas.

**3. Produção só depois do nosso retorno.**

A dev é o único ensaio disponível. Subir as duas na mesma janela anula a validação.

---

## Janela e rollback

- Produção precisa de downtime mínimo. É um site institucional público.
- Mantenham um caminho de rollback disponível por alguns dias após a produção subir, não apenas durante a janela.
- Se usarem Blue/Green: as instâncias são `db.t3.medium`, família sem inicialização de storage. Lentidão nos primeiros minutos após o switchover é esperada (lazy loading do S3) e não é motivo para reverter.

---

## Depois de concluído

Encerrar o Extended Support das duas instâncias. Sem isso a cobrança por vCPU-hora continua mesmo já estando no 8.4.

---

Contexto técnico completo, se precisarem: [`UPGRADE_MYSQL_8.4.md`](./UPGRADE_MYSQL_8.4.md)

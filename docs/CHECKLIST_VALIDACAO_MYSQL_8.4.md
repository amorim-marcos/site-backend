# Checklist de validação - upgrade MySQL 8.4

Mesma lista para a dev e para a produção. Preencher uma cópia por ambiente.

**Ambiente:** ( ) dev  ( ) produção
**Data:**
**Responsável:**

O foco é leitura de dados existentes, que passaram pelo upgrade. O boot da
aplicação já foi validado localmente contra base vazia; o que ainda não foi
exercitado é o schema real depois da migração de versão.

---

## 1. Configuração

- [ ] `SELECT VERSION();` retorna `8.4.10`
- [ ] Parameter group anexado é o `bnk-site-mysql84`, com status `in-sync`
- [ ] Plugin ativo:

```sql
SELECT plugin_name, plugin_status FROM information_schema.plugins
  WHERE plugin_name = 'mysql_native_password';
```

- [ ] O usuário `admin` continua em `mysql_native_password`:

```sql
SELECT user, host, plugin FROM mysql.user WHERE user = 'admin';
```

---

## 2. Fidelidade de tipos

O risco silencioso: o driver devolver `0`/`1` no lugar de boolean, ou string
no lugar de número. Não lança erro, só chega errado no frontend.

Booleanos, precisam vir `true` ou `false`:

- [ ] `posts`, campo `is_highlighted`
- [ ] `contact-channels`, campo `emphasis`
- [ ] `where-we-are`, campo `inauguration_soon`

Decimais, precisam vir como número e não string:

- [ ] `our-commitment`, campos `carbon_sequestration` e `atmospheric_emissions`
- [ ] Produto com o componente `body-proof`, campos `absorbed_water`,
      `absorption`, `thickness_increase`, `swelling`

---

## 3. Caminhos de query customizada

São os dois pontos do backend que não usam o caminho padrão do Strapi.
Ambos se testam abrindo página.

- [ ] **Detalhe de produto.** Exercita o filtro relacional em
      `api/products/controllers/products.js:27`, que busca ambientes
      atravessando a tabela de junção.
      Conferir: seção de ambientes relacionados aparece, e a navegação
      para produto anterior e próximo funciona.

- [ ] **Ambiente por slug.** Exercita o `LIKE` em
      `api/ambients/services/ambients.js:17`, que desce direto no bookshelf.
      Conferir: a página resolve pelo `url_code`.

---

## 4. Painel admin

- [ ] Login
- [ ] Listagem de conteúdo
- [ ] Editar e **salvar** um registro (valida escrita, não só leitura)
- [ ] Busca do admin (único consumidor do `_q` do Strapi)
- [ ] Upload de mídia

---

## 5. Integrações

- [ ] Meilisearch reindexa ao salvar conteúdo
- [ ] `pm2 logs backend --lines 200` sem erros novos

---

## 6. Frontend

Validar o Strapi não é validar o site. Abrir as páginas consumindo este backend:

- [ ] Home
- [ ] Listagem de produtos
- [ ] Detalhe de produto
- [ ] Ambientes
- [ ] Uma página com campos decimais renderizados (dados técnicos de produto)

---

## Conclusão

- [ ] Aprovado
- [ ] Reprovado. Ocorrências:

Na dev, deixar o ambiente em uso por alguns dias antes de liberar a produção.
Quanto mais tempo rodando, maior a chance de algo sutil aparecer antes.

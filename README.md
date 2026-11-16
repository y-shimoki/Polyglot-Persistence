# Tema Escolhido

O projeto é uma **plataforma de avaliação de livros**. Nela, os usuários podem se cadastrar, explorar o catálogo de livros, escrever reviews (nota e comentário) e marcar livros como favoritos para consultar depois.

A plataforma também conta com uma área de **administração**, em que o administrador pode **adicionar, editar e remover livros** do catálogo. As credenciais do administrador não ficam armazenadas em nenhum banco de dados: elas são definidas por variáveis de ambiente no arquivo `.env`, o que dispensa uma tabela específica para esse perfil.

O sistema combina três bancos de dados distintos, um relacional e dois não relacionais (NoSQL), cada um escolhido de acordo com o tipo de dado que armazena e com o padrão de acesso esperado:

| Dado | Banco | Motivo resumido |
|---|---|---|
| Usuários e relação Usuário_Livro | PostgreSQL | Dados estruturados e com relacionamentos |
| Livros e Reviews | MongoDB | Documentos flexíveis e leitura frequente |
| Sessões de usuário | Redis | Acesso rápido em memória e expiração automática |

# Bancos de dados utilizados

## 1. PostgreSQL

**Plataforma:** [Neon](https://neon.tech) (PostgreSQL serverless na nuvem)
**Biblioteca:** [`postgres`](https://www.npmjs.com/package/postgres)

**Dados armazenados:** tabelas `Usuarios` e `Usuario_Livro`.

**Justificativa:** os dados de usuários e a relação entre usuários e livros são estruturados, têm esquema bem definido e exigem integridade. O PostgreSQL oferece:

- **Chaves primárias e estrangeiras**, garantindo que um registro em `Usuario_Livro` sempre referencie um usuário existente.
- **Restrições de unicidade** (`UNIQUE`), como user único por usuário e um único registro por par usuário–livro, evitando favoritos duplicados.
- **Transações ACID**, que mantêm a consistência em operações como cadastro e favoritar/desfavoritar.
- Consultas relacionais (`JOIN`) eficientes para listar os livros favoritos de cada usuário.

**Estrutura das tabelas:**

```sql
CREATE TABLE public."Usuarios" (
  "user" VARCHAR(150) PRIMARY KEY,
  senha VARCHAR(150) NOT NULL,
);

CREATE TABLE public."Usuario_livro" (
  "user"   VARCHAR,
  "bookId" VARCHAR,
  CONSTRAINT "user_bookId" PRIMARY KEY ("user", "bookId"),
  CONSTRAINT "user" FOREIGN KEY ("user") REFERENCES public."Usuarios" ("user")
);
```

- **`Usuarios`:** `user` é a chave primária (identificador único do usuário) e `senha` é obrigatória.
- **`Usuario_livro`:** a chave primária composta `(user, bookId)` impede que o mesmo livro seja favoritado duas vezes pelo mesmo usuário. O índice `BTREE` único sobre `(user, bookId)` é criado automaticamente por essa chave primária. A chave estrangeira `user` garante que só existam registros de usuários cadastrados em `Usuarios`.

> Como o livro está no MongoDB, `bookId` guarda o `_id` do documento como referência lógica (não é uma chave estrangeira real, pois ela não funciona entre bancos diferentes).

**Implementação no backend:** a conexão é feita com a biblioteca `postgres`, usando a *connection string* fornecida pelo Neon (variável `DATABASE_URL_POOLED`) com SSL. As consultas usam *tagged templates*, que parametrizam os valores automaticamente e protegem contra SQL Injection.

```js
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

// Exemplo: listar favoritos de um usuário
export async function getLivrosDoUsuario(user) {
    return await sql`
        SELECT "bookId" FROM "Usuario_Livro"
        WHERE "user" = ${user}
    `;
}
```

## 2. MongoDB

**Plataforma:** [MongoDB Atlas](https://www.mongodb.com/atlas) (cluster na nuvem)
**Biblioteca:** [`mongoose`](https://www.npmjs.com/package/mongoose)

**Dados armazenados:** coleções `Livros` e `Reviews`.

**Justificativa:** livros e reviews são dados mais flexíveis e orientados a documentos, com muita leitura e crescimento constante. O MongoDB é adequado porque:

- **Esquema flexível:** livros podem ter atributos variados (título, múltiplos gêneros, autor, sinopse, imagens) sem a necessidade de alterar tabelas.
- **Documentos aninhados e arrays:** gêneros ficam dentro do próprio documento, evitando tabelas auxiliares e `JOIN`s.
- **Escalabilidade horizontal** para o volume crescente de reviews.
- **Agregações** (`aggregate`) possibilidade de calcular média de notas e quantidade de avaliações por livro, por exemplo.

**Modelos:**

```js
import mongoose from "mongoose";

const LivroSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  autor: {
    type: String,
    required: true
  },
  genero: {
    type: [String],
    required: true
  },
  sinopse: {
    type: String,
    required: true
  },
  capa: {
    type: String
  }
});

const ReviewSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }, 
  user: {
    type: String,
    required: true
  },
  nota: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comentario: {
    type: String
  }
});

const Livro = mongoose.model("Livro", LivroSchema, "Livros");
const Review = mongoose.model("Review", ReviewSchema, "Reviews");
```

**Implementação no backend:** o `mongoose` conecta ao cluster do Atlas por meio da *connection string* (variável `MONGODB_URI`). Ele fornece validação de schemas, modelos e *queries* encadeáveis. O `user` da coleção `Reviews` referencia o `user` da tabela `Usuarios` no PostgreSQL.

## 3. Redis

**Biblioteca:** [`ioredis`](https://www.npmjs.com/package/ioredis)

**Dados armazenados:** sessões dos usuários autenticados.

**Justificativa:** a validação da sessão ocorre em praticamente toda requisição autenticada. Consultar o PostgreSQL a cada vez seria desnecessariamente custoso. O Redis resolve isso porque:

- **Armazena os dados em memória**, com latência muito baixa.
- **Suporta expiração automática (TTL)**: a sessão é removida sozinha após o tempo definido, sem rotinas de limpeza.
- Estrutura **chave–valor** simples, ideal para o par `sessão → dados do usuário`.
- **Reduz a carga no PostgreSQL**, que fica dedicado aos dados persistentes.

**Implementação no backend:** 

... ( completar )



# Como usar

## 1. Tenha o Node.js instalado no seu sistema

Digite o comando abaixo para verificar se o Node.js está instalado:

```bash
node -v
```

A saída deve ser o número de versão do Node.js instalado em seu sistema.

Se o comando falhar, você precisa instalar o Node.js. Nesse caso, se você estiver usando Windows, digite no terminal:

```ps1
winget install OpenJS.NodeJS
```

## 2. Clone o repositório e instale as dependências

Para clonar o repositório, abra o terminal em uma pasta de sua escolha, e digite:

```bash
git clone https://github.com/y-shimoki/Polyglot-Persistence.git PolyglotPersistence
```

Em seguida, digite os comandos:

```bash
cd PolyglotPersistence
npm install
```

Esse último comando irá instalar as dependências do projeto.

## 3. Execute o projeto

Execute o comando:

```bash
npm run start
```

Ele irá inicializar o projeto e, após confirmar a conexão com os bancos de dados, irá permitir seu uso através da URL `http://localhost:3000`, que você poderá abrir pelo navegador.

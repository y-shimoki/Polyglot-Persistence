import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_POOLED, {
    ssl: 'require'
});

export async function connectToPostgreSQL() {
    try {
        await sql`SELECT 1`;
        console.log("PostgreSQL Conectado!");
        return sql;
    } catch (err) {
        console.error("Erro ao conectar ao PostgreSQL:", err);
        throw err;
    }
}

// buscar um usuário específico: 
export async function getUsuario(user) {
    const resultado = await sql`
        SELECT * FROM "Usuarios"
        WHERE "user" = ${user}
    `;

    return resultado[0] || null;
}

// cadastro:
export async function cadastrarUsuario(user, senha) {
    return await sql`
        INSERT INTO "Usuarios" ("user", senha)
        VALUES (${user}, ${senha})
    `;
}

// adicionar livro na conta de um usuário: 
export async function adicionarLivro(user, bookId) {
    return await sql`
        INSERT INTO "Usuario_Livro" ("user", "bookId")
        VALUES (${user}, ${bookId})
    `;
}

// buscar todos os livros que um usuário possui: 
export async function getLivrosDoUsuario(user) {
    return await sql`
        SELECT "bookId" FROM "Usuario_Livro"
        WHERE "user" = ${user}
    `;
}

// verifica se um usuário possui um livro específico: 
export async function verificarPosse(user, bookId) {
    const check = await sql`
        SELECT * FROM "Usuario_Livro"
        WHERE "user" = ${user}
        AND "bookId" = ${bookId}
    `;

    return check.length > 0;
}

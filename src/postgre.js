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

// CREATE //
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

// READ //
// buscar todos os livros que um usuário possui: 
export async function getLivrosDoUsuario(user) {
    return await sql`
        SELECT "bookId" FROM "Usuario_Livro"
        WHERE "user" = ${user}
    `;
}

// buscar um usuário específico: 
export async function getUsuario(user) {
    const resultado = await sql`
        SELECT * FROM "Usuarios"
        WHERE "user" = ${user}
    `;

    return resultado[0] || null;
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

// UPDATE //
// atualizar somente a senha: 
export async function updateSenha(user, novaSenha) {
    return await sql`
        UPDATE "Usuarios"
        SET senha = ${novaSenha}
        WHERE "user" = ${user}
    `;
}

// DELETE //
// excluir a conta de um usuário: 
export async function deleteAccount(user) {
    // apaga os livros do usuário (tabela "Usuario_Livro"):
    await sql`
        DELETE FROM "Usuario_Livro"
        WHERE "user" = ${user}
    `;

    // apaga o usuário da tabela "Usuarios":
    return await sql`
        DELETE FROM "Usuarios"
        WHERE "user" = ${user}
    `;
}

// desfavoritar um livro:
export async function removerLivro(user, bookId) {
    return await sql`
        DELETE FROM "Usuario_Livro"
        WHERE "user" = ${user}
        AND "bookId" = ${bookId}
    `;
}
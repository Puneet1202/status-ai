/**
 * D1 SQL Database Connector Instance
 * Hono framework mein dynamic environment bindings context se aate hain (c.env.DB)
 */
export function getD1Client(c) {
    if (!c.env || !c.env.DB) {
        throw new Error("[Database Exception] Cloudflare D1 Binding 'DB' missing inside wrangler.toml");
    }
    return c.env.DB;
}   
import { getSupabaseClient } from '../db/supabase.js';

export async function saveEmbedding(env, transactionId, text) {
    try {
        const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [text]
        });

        const embedding = response.data[0]; // pehle define karo
        
        console.log('[Embedding] Vector length:', embedding?.length); // phir use karo
        console.log('[Embedding] Updating id:', transactionId);

        const supabase = getSupabaseClient(env);
        const { error } = await supabase
            .from('transactions')
            .update({ embedding })
            .eq('id', transactionId);

        if (error) console.error('[Embedding] Supabase error:', error.message);
        else console.log('[Embedding] Saved successfully!');

    } catch (err) {
        console.error('[Embedding] Failed:', err.message);
    }
}
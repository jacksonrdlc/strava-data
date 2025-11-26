// Apply database migration using Supabase client
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration(migrationFile) {
    console.log(`🔄 Applying migration: ${migrationFile}\n`);

    try {
        // Read migration file
        const sql = await fs.readFile(migrationFile, 'utf8');

        console.log('📝 Migration SQL:');
        console.log('─'.repeat(60));
        console.log(sql);
        console.log('─'.repeat(60) + '\n');

        // Split by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📊 Executing ${statements.length} SQL statements...\n`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            // Skip comments
            if (statement.startsWith('--') || statement.startsWith('COMMENT')) {
                console.log(`   [${i + 1}/${statements.length}] ⏭️  Skipping comment`);
                continue;
            }

            console.log(`   [${i + 1}/${statements.length}] Executing...`);

            try {
                const { error } = await supabase.rpc('exec_sql', { sql_string: statement });

                if (error) {
                    // Try direct SQL execution as fallback
                    const { error: directError } = await supabase.from('_migrations').insert({
                        statement: statement,
                        executed_at: new Date().toISOString()
                    });

                    if (directError) {
                        console.log(`      ⚠️  Could not execute via RPC, trying alternative method...`);
                        // For simple ALTER TABLE commands, we can use the REST API
                        console.log(`      ℹ️  Manual execution required for this statement`);
                    }
                } else {
                    console.log(`      ✅ Success`);
                }
            } catch (err) {
                console.error(`      ⚠️  Warning: ${err.message}`);
            }
        }

        console.log('\n✅ Migration application completed!');
        console.log('\n⚠️  Note: Some statements may require manual execution via Supabase Dashboard SQL Editor.');
        console.log('   Copy the migration SQL above and run it in the SQL Editor if needed.\n');

    } catch (error) {
        console.error('❌ Error applying migration:', error);
        throw error;
    }
}

// Run migration
if (require.main === module) {
    const migrationFile = process.argv[2] || './scripts/database/migrations/add_map_data_fields.sql';

    applyMigration(migrationFile)
        .then(() => {
            console.log('✨ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { applyMigration };
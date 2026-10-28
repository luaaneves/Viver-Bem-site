// Viver Bem – ligação com o Supabase
// Preencha depois de criar o projeto (veja GUIA-SUPABASE.md).
// A chave "anon" é feita para ficar no site: quem protege os dados são as regras (RLS) do schema.sql.
// NUNCA coloque aqui a chave "service_role".
const SUPABASE_URL = "https://ikkjskrscqzpqvrhalzt.supabase.co";       // ex.: "https://abcdxyz.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra2pza3JzY3F6cHF2cmhhbHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTczMDEsImV4cCI6MjEwODc5MzMwMX0.vG0kktHPC-FaqxcQ8LcI9GZLqiWJraJDAC7BmWsUzos";  // ex.: "eyJhbGciOi..."

// Enquanto estiver vazio, o site usa data/produtos.json normalmente.

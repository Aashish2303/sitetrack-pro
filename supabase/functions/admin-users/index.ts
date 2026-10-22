import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import {createAdminHandler} from './handler.ts';
Deno.serve(createAdminHandler(createClient,name=>Deno.env.get(name)));

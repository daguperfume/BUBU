// ===========================================
// BUBU GEBEYA  -  Supabase Core (Refined)
// ===========================================
const supabaseUrl = 'https://vkkktccqcphvppeopvmu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZra2t0Y2NxY3BodnBwZW9wdm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDAxOTcsImV4cCI6MjA5MjAxNjE5N30.3BZtTZ8t4w9n3IKggKYT7SD4tIjcrlmIML_a62ojzAo';
const sb = supabase.createClient(supabaseUrl, supabaseKey);
const _sbDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// --- UPLOAD PHOTOS ---------------------------------------
async function uploadPhotosToStorage(photos) {
  const urls = [];
  const timestamp = Date.now();

  for (let i = 0; i < photos.length; i++) {
    const file = photos[i];
    const ext = file.name.split('.').pop();
    const fileName = `item_${timestamp}_${i}.${ext}`;

    if (_sbDev) console.log(`📤 Uploading photo ${i+1}/${photos.length}: ${fileName}...`);

    const { data, error } = await sb.storage
      .from('market-gallery')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
       if (_sbDev) console.error('❌ STORAGE ERROR:', error.message);
       throw error;
    }

    const { data: { publicUrl } } = sb.storage
      .from('market-gallery')
      .getPublicUrl(fileName);

    if (_sbDev) console.log('✅ Photo ready at:', publicUrl);
    urls.push(publicUrl);
  }
  return urls;
}

// --- SAVE AD ---------------------------------------------
async function saveAdToSupabase(adData) {
  if (_sbDev) console.log("💾 Attempting to save ad data to 'ads' table...");
  const { data, error } = await sb
    .from('ads')
    .upsert([adData], { onConflict: 'id' })
    .select();

  if (error) {
    if (_sbDev) console.error('❌ DATABASE ERROR:', error.message);
    throw error;
  }
  
  if (_sbDev) console.log('🎉 Successfully saved ad row!');
  return data[0];
}

// --- FETCH ADS -------------------------------------------
async function fetchAdsFromSupabase() {
  const { data, error } = await sb
    .from('ads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// --- PROFILE SYNC ----------------------------------------
async function syncProfileToSupabase(profileData) {
  const { error } = await sb
    .from('profiles')
    .upsert([profileData], { onConflict: 'id' });
  if (error) throw error;
}

async function getProfileFromSupabase(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

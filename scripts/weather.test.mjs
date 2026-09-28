import './register-ts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {getWeather,getCuratedWeather}=await import('../services/weather/weatherProvider.ts');

test('weather refresh bypasses caches, retains original timestamps and language after failure',async()=>{
  const originalFetch=globalThis.fetch;
  const disabled=process.env.WEATHER_DISABLED;
  process.env.WEATHER_DISABLED='false';
  let calls=0,fail=false;
  let forecastLongitude;
  globalThis.fetch=async input=>{
    calls++;
    if(fail) throw new Error('test offline');
    const url=new URL(input);
    if(url.searchParams.get('name')==='Shanghai') return Response.json({results:[
      {name:'上海',country_code:'CN',population:24874500,latitude:31.22,longitude:121.46},
      {name:'Shanghai',country_code:'US',latitude:34.85,longitude:-87.08}
    ]});
    if(url.searchParams.has('longitude')) forecastLongitude=url.searchParams.get('longitude');
    return Response.json(url.hostname.startsWith('geocoding')?{results:[{name:url.searchParams.get('name'),latitude:31.22,longitude:121.46,country_code:'CN'}]}:{current:{temperature_2m:25,weather_code:3},daily:{temperature_2m_max:[28],temperature_2m_min:[22]}});
  };
  try {
    const live=await getWeather('Regression City','zh');
    assert.equal(live.mode,'live');
    const initialCalls=calls;
    await getWeather('Regression City','zh');
    assert.equal(calls,initialCalls,'fresh results are cached');
    fail=true;
    const stale=await getWeather('Regression City','zh',{refresh:true});
    assert.equal(stale.mode,'fallback');
    assert.equal(stale.updatedAt,live.updatedAt,'failure cannot make old readings look new');
    const example=await getWeather('Regression City','en',{refresh:true});
    assert.equal(example.source,'Curated snapshot','Chinese cache must not leak into English');
    assert.equal(example.updatedAt,undefined);
    assert.match(example.note,/not current weather/);
    const failedCalls=calls;
    await getWeather('Regression City','en');
    assert.equal(calls,failedCalls,'automatic requests respect failure cooldown');
    fail=false;
    const recovered=await getWeather('Regression City','en',{refresh:true});
    assert.equal(recovered.mode,'live');
    assert.equal(recovered.condition,'Overcast');
    assert.ok(calls>failedCalls,'manual refresh retries immediately');
    assert.equal(getCuratedWeather().updatedAt,undefined);
    const shanghai=await getWeather('Shanghai','zh',{refresh:true});
    assert.equal(shanghai.city,'上海','localized metropolis must beat a foreign namesake');
    assert.equal(forecastLongitude,'121.46');
  } finally {
    globalThis.fetch=originalFetch;
    if(disabled===undefined) delete process.env.WEATHER_DISABLED;else process.env.WEATHER_DISABLED=disabled;
  }
});

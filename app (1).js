// ==========================================================
// WMS HUB — app.js
// Navegação, explorador de tabelas, diagrama de relações, guia
// ==========================================================

const VIEWS = ['home','tabelas','diagrama','guia','inserir','conhecimento'];
const TITLES = {
  home:'Início',
  tabelas:'Explorador de Tabelas',
  diagrama:'Diagrama de Relações',
  guia:'Guia de Configuração',
  inserir:'Inserir Informação',
  conhecimento:'Base de Conhecimento'
};
const CRUMBS = {
  home:'wms-hub / painel',
  tabelas:'wms-hub / base-de-dados / tabelas',
  diagrama:'wms-hub / base-de-dados / diagrama',
  guia:'wms-hub / implantação / guia',
  inserir:'wms-hub / ia-do-processo / inserir',
  conhecimento:'wms-hub / ia-do-processo / base-de-conhecimento'
};

const KB_STORAGE_KEY = 'wms-hub:conhecimento';

let activeModuleFilter = null; // null = todos
let currentSearch = '';

// ---------- helpers ----------
function tableByCode(code){
  for(const mod of DB_TABELAS){
    for(const it of mod.itens){
      if(it.tabela === code) return {...it, modulo: mod.modulo};
    }
  }
  return null;
}
function relsForTable(code){
  return DB_REL.filter(r => r.de === code || r.para === code);
}
function allTableCodes(){
  const set = new Set();
  DB_TABELAS.forEach(m => m.itens.forEach(i => set.add(i.tabela)));
  return set;
}

// ---------- navigation ----------
function goToView(view, opts){
  opts = opts || {};
  VIEWS.forEach(v=>{
    document.getElementById('view-'+v).hidden = (v !== view);
  });
  document.querySelectorAll('.menu-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.view === view);
  });
  document.getElementById('topbar-title').textContent = TITLES[view];
  document.getElementById('topbar-crumb').textContent = CRUMBS[view];
  document.getElementById('global-search-wrap').style.display = (view === 'tabelas') ? 'block' : 'none';

  if(view === 'tabelas') renderTabelas();
  if(view === 'diagrama') renderDiagrama();
  if(view === 'guia') renderGuia(opts.pontos);
  if(view === 'conhecimento') renderKbBoard();
  if(view === 'inserir') resetKbForm();

  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0,0);
}

document.querySelectorAll('[data-view]').forEach(el=>{
  el.addEventListener('click', ()=> goToView(el.dataset.view, {pontos: el.dataset.targetPontos}));
});

// ---------- HOME stats ----------
function fillStats(){
  const total = DB_TABELAS.reduce((s,m)=>s+m.itens.length,0);
  document.getElementById('stat-tabelas').textContent = total;
  document.getElementById('stat-modulos').textContent = DB_TABELAS.length;
  document.getElementById('stat-rel').textContent = DB_REL.length;
  document.getElementById('stat-etapas').textContent = DB_CONFIG.filter(e=>e.etapa.startsWith('Etapa')).length;
  document.getElementById('cnt-tabelas').textContent = total;
  document.getElementById('cnt-etapas').textContent = DB_CONFIG.filter(e=>e.etapa.startsWith('Etapa')).length;
  const kb = loadKB();
  document.getElementById('stat-kb').textContent = kb.length;
  document.getElementById('cnt-kb').textContent = kb.length;
}

// ---------- TABELAS view ----------
function renderModuleFilters(){
  const wrap = document.getElementById('module-filters');
  wrap.innerHTML = '';
  const allPill = document.createElement('div');
  allPill.className = 'pill' + (activeModuleFilter===null ? ' on' : '');
  allPill.textContent = 'Todos os módulos';
  allPill.onclick = ()=>{ activeModuleFilter = null; renderModuleFilters(); renderTabelas(); };
  wrap.appendChild(allPill);
  DB_TABELAS.forEach(m=>{
    const p = document.createElement('div');
    p.className = 'pill' + (activeModuleFilter===m.modulo ? ' on' : '');
    p.textContent = m.modulo + ' (' + m.itens.length + ')';
    p.onclick = ()=>{ activeModuleFilter = (activeModuleFilter===m.modulo) ? null : m.modulo; renderModuleFilters(); renderTabelas(); };
    wrap.appendChild(p);
  });
}

function renderTabelas(){
  renderModuleFilters();
  const container = document.getElementById('tabelas-container');
  container.innerHTML = '';
  const q = currentSearch.trim().toLowerCase();

  DB_TABELAS.forEach(mod=>{
    if(activeModuleFilter && mod.modulo !== activeModuleFilter) return;
    const filtered = mod.itens.filter(it=>{
      if(!q) return true;
      return (it.entidade+' '+it.descricao+' '+it.tabela).toLowerCase().includes(q);
    });
    if(filtered.length === 0) return;

    const section = document.createElement('div');
    section.className = 'module-section';

    const head = document.createElement('div');
    head.className = 'module-head';
    head.textContent = mod.modulo + ' — ' + filtered.length + ' tabela(s)';
    section.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'table-grid';

    filtered.forEach(it=>{
      const row = document.createElement('div');
      row.className = 'table-row';
      const rels = relsForTable(it.tabela);
      row.innerHTML = `
        <div class="tag-code">${it.tabela}</div>
        <div>
          <div class="ent-name">${it.entidade}</div>
          <div class="ent-desc">${it.descricao}</div>
        </div>
        <div>${rels.length ? `<span class="rel-badge">${rels.length} ligação${rels.length>1?'ões':''}</span>` : `<span class="no-rel">sem mapa</span>`}</div>
      `;
      row.onclick = ()=> openDrawer(it.tabela);
      grid.appendChild(row);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });

  if(container.innerHTML === ''){
    container.innerHTML = '<div style="color:var(--text-faint);padding:40px;text-align:center;font-family:var(--mono);font-size:12.5px;">nenhuma tabela encontrada para essa busca</div>';
  }
}

document.getElementById('global-search').addEventListener('input', e=>{
  currentSearch = e.target.value;
  renderTabelas();
});

// ---------- DRAWER (detalhe da tabela) ----------
function openDrawer(code){
  const info = tableByCode(code);
  const rels = relsForTable(code);
  const content = document.getElementById('drawer-content');

  let relHtml = '';
  if(rels.length){
    relHtml = rels.map(r=>{
      const other = (r.de === code) ? r.para : r.de;
      const dir = (r.de === code) ? `${code} → ${r.para}` : `${r.de} → ${code}`;
      return `<div class="rel-item">
        <div class="arrow-line">${dir}  <span style="color:var(--text-faint);">· chave: ${r.campo}</span></div>
        ${r.desc}
      </div>`;
    }).join('');
  } else {
    relHtml = `<div style="color:var(--text-faint);font-size:12px;">Nenhum relacionamento documentado ainda pra essa tabela — pode ser adicionado conforme for mapeando em projeto.</div>`;
  }

  content.innerHTML = `
    <div class="module-tag">${info ? info.modulo : ''}</div>
    <div class="tag-code" style="display:inline-block;margin-top:6px;">${code}</div>
    <h3>${info ? info.entidade : code}</h3>
    <div style="color:var(--text-dim);font-size:13px;">${info ? info.descricao : ''}</div>

    <div class="drawer-section">
      <h4>Relacionamentos conhecidos</h4>
      ${relHtml}
    </div>
  `;
  document.getElementById('drawer').classList.add('show');
  document.getElementById('drawer-backdrop').classList.add('show');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('drawer-backdrop').classList.remove('show');
}
document.getElementById('drawer-close').onclick = closeDrawer;
document.getElementById('drawer-backdrop').onclick = closeDrawer;

// ---------- DIAGRAMA (SVG) ----------
function renderDiagrama(){
  const wrap = document.getElementById('diagram-wrap');
  wrap.innerHTML = '';

  // build node list from relationships (only tables that appear in DB_REL, grouped loosely)
  const nodesSet = new Set();
  DB_REL.forEach(r=>{ nodesSet.add(r.de); nodesSet.add(r.para); });
  const nodes = Array.from(nodesSet);

  // simple layered layout: group by rough theme buckets for readability
  const buckets = [
    {label:'Config. / Cadastro base', codes:['TGFTOP','TGFLOC','TGFPRO','TGFEMP','TGFCAB','TGWEND','TGWARA','TGWDCA']},
    {label:'Armazenagem', codes:['TGWARM','TGWRFA','TGWRARM']},
    {label:'Tarefas / Separação', codes:['TGWTAR','TGWITT','TGFITE','TGWSEP','TGWSXN','TGWOND']},
    {label:'Recebimento / Conferência', codes:['TGWREC','TGWITER','TGWRXN','TGWCON','TGWCOI']},
    {label:'Estoque', codes:['TGWEST']},
    {label:'Equipamentos', codes:['TGWEQP','TGWTTE']},
  ];

  const colW = 210, rowH = 64, padTop = 30, padLeft = 20;
  const positions = {};
  let maxRows = 0;
  buckets.forEach((b, colIdx)=>{
    const present = b.codes.filter(c=>nodes.includes(c));
    present.forEach((code, rowIdx)=>{
      positions[code] = {
        x: padLeft + colIdx*colW + colW/2,
        y: padTop + rowIdx*rowH + 40
      };
      maxRows = Math.max(maxRows, rowIdx+1);
    });
  });
  const width = padLeft + buckets.length*colW + 40;
  const height = padTop + maxRows*rowH + 100;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="min-width:100%;">`;

  // column headers
  buckets.forEach((b, colIdx)=>{
    const x = padLeft + colIdx*colW + colW/2;
    svg += `<text x="${x}" y="20" text-anchor="middle" fill="#5c6a90" font-family="JetBrains Mono, monospace" font-size="10" letter-spacing="1">${b.label.toUpperCase()}</text>`;
  });

  // edges (draw first, under nodes)
  DB_REL.forEach(r=>{
    const a = positions[r.de], b = positions[r.para];
    if(!a || !b) return;
    const midx = (a.x+b.x)/2;
    svg += `<path d="M ${a.x} ${a.y} C ${midx} ${a.y}, ${midx} ${b.y}, ${b.x} ${b.y}" fill="none" stroke="#0f5c58" stroke-width="1.6" opacity="0.7"/>`;
  });

  // nodes
  Object.keys(positions).forEach(code=>{
    const p = positions[code];
    const info = tableByCode(code);
    svg += `<g class="dnode" data-code="${code}" style="cursor:pointer;">
      <rect x="${p.x-60}" y="${p.y-16}" width="120" height="32" rx="7" fill="#182746" stroke="#f5b301" stroke-width="1.3"/>
      <text x="${p.x}" y="${p.y+4}" text-anchor="middle" fill="#f5b301" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700">${code}</text>
    </g>`;
  });

  svg += `</svg>`;
  wrap.innerHTML = svg;

  wrap.querySelectorAll('.dnode').forEach(g=>{
    g.addEventListener('click', ()=> openDrawer(g.dataset.code));
  });
}

// ---------- GUIA ----------
let openEtapaIndex = 0;
function renderGuia(scrollToPontos){
  const container = document.getElementById('guia-container');
  container.innerHTML = '';

  DB_CONFIG.forEach((etapa, idx)=>{
    const block = document.createElement('div');
    block.className = 'etapa-block' + (idx === openEtapaIndex ? ' open' : '');
    block.id = etapa.etapa.startsWith('Pontos') ? 'block-pontos' : ('block-etapa-'+idx);

    const isPontos = etapa.etapa.startsWith('Pontos');
    const head = document.createElement('div');
    head.className = 'etapa-head';
    head.innerHTML = `
      <div class="etapa-num">${isPontos ? '⚠' : etapa.etapa.replace('Etapa ','')}</div>
      <div class="t">${etapa.titulo || etapa.etapa}</div>
      <div class="chev">▶</div>
    `;
    head.onclick = ()=>{
      block.classList.toggle('open');
    };

    const body = document.createElement('div');
    body.className = 'etapa-body';

    if(etapa.contexto){
      body.innerHTML += `<div class="etapa-context">${etapa.contexto}</div>`;
    }

    if(etapa.itens && etapa.itens.length){
      let lastSub = null;
      etapa.itens.forEach(it=>{
        if(it.sub && it.sub !== lastSub){
          body.innerHTML += `<div class="sub-label">${it.sub}</div>`;
          lastSub = it.sub;
        }
        body.innerHTML += `
          <div class="cfg-item">
            <div class="it">${it.item}</div>
            <div class="im">${it.importante}</div>
            <div class="cfg-meta">
              ${it.rotina ? `<span class="rt">${it.rotina}</span>` : ''}
              ${it.help ? `<a href="${it.help}" target="_blank" rel="noopener">Help ↗</a>` : ''}
            </div>
          </div>
        `;
      });
    }

    if(etapa.pontos && etapa.pontos.length){
      const ul = document.createElement('ul');
      ul.className = 'pontos-list';
      etapa.pontos.forEach(p=>{
        const li = document.createElement('li');
        li.innerHTML = `<span>${p}</span>`;
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    block.appendChild(head);
    block.appendChild(body);
    container.appendChild(block);
  });

  if(scrollToPontos){
    setTimeout(()=>{
      const el = document.getElementById('block-pontos');
      if(el){
        el.classList.add('open');
        el.scrollIntoView({behavior:'smooth', block:'start'});
      }
    }, 50);
  }
}

// ==========================================================
// IA DO PROCESSO — classificador + base de conhecimento
// ==========================================================

// ---------- storage (Firestore — compartilhado entre todos que acessam o Hub) ----------
const KB_COLLECTION = 'conhecimento';
let kbCache = [];
let kbReady = false;

function initKbListener(){
  db.collection(KB_COLLECTION).orderBy('data', 'desc').onSnapshot(
    snapshot => {
      kbCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      kbReady = true;
      fillStats();
      const conhecimentoView = document.getElementById('view-conhecimento');
      if(conhecimentoView && !conhecimentoView.hidden) renderKbBoard();
    },
    err => {
      console.error('Erro ao ler a base de conhecimento no Firestore:', err);
      const board = document.getElementById('kb-board');
      if(board){
        board.innerHTML = `<div class="kb-empty" style="grid-column:1/-1;color:var(--danger);">
          Não consegui conectar na base de conhecimento compartilhada (Firestore).
          Verifique as regras de acesso do banco ou a conexão com a internet.
        </div>`;
      }
    }
  );
}

function loadKB(){
  return kbCache;
}
function addKbEntry(entry){
  return db.collection(KB_COLLECTION).add(entry);
}
function deleteKbEntry(id){
  return db.collection(KB_COLLECTION).doc(id).delete();
}
function catInfo(id){
  return PROCESS_CATEGORIES.find(c=>c.id===id) || PROCESS_CATEGORIES[PROCESS_CATEGORIES.length-1];
}

// ---------- classificador ----------
// Analisa texto livre: pontua por palavra-chave de cada etapa do processo,
// e dá bônus quando detecta um código de tabela (TGWxxx / TGFxxx) já mapeado
// para uma etapa (cruzando com o dicionário de tabelas do explorador).
function analyzeText(text){
  const t = (text || '').toLowerCase();
  const scores = {};
  PROCESS_CATEGORIES.forEach(c => scores[c.id] = 0);

  // 1) pontuação por palavra-chave
  Object.keys(CATEGORIA_KEYWORDS).forEach(catId=>{
    CATEGORIA_KEYWORDS[catId].forEach(kw=>{
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
      const matches = t.match(re);
      if(matches) scores[catId] += matches.length * 2;
    });
  });

  // 2) detectar códigos de tabela mencionados no texto (TGWxxx, TGFxxx)
  const codeMatches = (text.match(/\bTG[WF][A-Z0-9]{2,}\b/gi) || []).map(c=>c.toUpperCase());
  const detectedTables = [];
  codeMatches.forEach(code=>{
    const info = tableByCode(code);
    if(info && !detectedTables.find(d=>d.tabela===code)){
      detectedTables.push({tabela:code, entidade:info.entidade, modulo:info.modulo});
    }
    const cat = TABELA_CATEGORIA[code];
    if(cat) scores[cat] = (scores[cat]||0) + 5;
  });

  // 3) detectar entidades lógicas mencionadas pelo nome (ex: "Separação WMS")
  DB_TABELAS.forEach(mod=>{
    mod.itens.forEach(it=>{
      if(it.descricao && it.descricao.length > 4 && t.includes(it.descricao.toLowerCase())){
        const cat = TABELA_CATEGORIA[it.tabela];
        if(cat) scores[cat] = (scores[cat]||0) + 3;
        if(!detectedTables.find(d=>d.tabela===it.tabela)){
          detectedTables.push({tabela:it.tabela, entidade:it.entidade, modulo:mod.modulo});
        }
      }
    });
  });

  const ranked = PROCESS_CATEGORIES
    .map(c => ({id:c.id, label:c.label, cor:c.cor, score:scores[c.id]||0}))
    .sort((a,b)=> b.score - a.score);

  const maxScore = Math.max(1, ranked[0].score);
  const totalScore = ranked.reduce((s,r)=>s+r.score,0) || 1;
  const confidence = Math.round((ranked[0].score / totalScore) * 100);

  return {
    ranked, maxScore, detectedTables,
    suggested: ranked[0].score > 0 ? ranked[0].id : 'geral',
    confidence: ranked[0].score > 0 ? confidence : 0
  };
}

let lastAnalysis = null;

function resetKbForm(){
  document.getElementById('kb-titulo').value = '';
  document.getElementById('kb-texto').value = '';
  document.getElementById('kb-analysis').classList.remove('show');
  lastAnalysis = null;
}

function renderAnalysis(analysis){
  const scoresWrap = document.getElementById('kb-scores');
  scoresWrap.innerHTML = analysis.ranked.map(r=>{
    const pct = Math.round((r.score / analysis.maxScore) * 100);
    return `
      <div class="cat-score-row">
        <div class="lbl">${r.label}</div>
        <div class="cat-score-bar-wrap"><div class="cat-score-bar" style="width:${pct}%;background:${r.cor};"></div></div>
        <div class="cat-score-val">${r.score}</div>
      </div>
    `;
  }).join('');

  const detectedWrap = document.getElementById('kb-detected-wrap');
  const detectedEl = document.getElementById('kb-detected');
  if(analysis.detectedTables.length){
    detectedWrap.style.display = 'block';
    detectedEl.innerHTML = analysis.detectedTables.map(d=>
      `<span class="rel-badge" style="cursor:pointer;" data-code="${d.tabela}">${d.tabela} · ${d.entidade}</span>`
    ).join('');
    detectedEl.querySelectorAll('[data-code]').forEach(el=>{
      el.onclick = ()=> openDrawer(el.dataset.code);
    });
  } else {
    detectedWrap.style.display = 'none';
  }

  const sugg = catInfo(analysis.suggested);
  const banner = document.getElementById('kb-suggestion');
  if(analysis.confidence > 0){
    banner.innerHTML = `A IA sugere classificar em <b>${sugg.label}</b> (confiança ${analysis.confidence}%). Revise e confirme abaixo.`;
  } else {
    banner.innerHTML = `Não encontrei palavras-chave fortes o suficiente — classificado como <b>Geral / Configuração</b> por padrão. Ajuste manualmente se souber a etapa certa.`;
  }

  const select = document.getElementById('kb-categoria-final');
  select.innerHTML = PROCESS_CATEGORIES.map(c=>
    `<option value="${c.id}" ${c.id===analysis.suggested?'selected':''}>${c.label}</option>`
  ).join('');

  document.getElementById('kb-analysis').classList.add('show');
}

document.getElementById('kb-analisar-btn').addEventListener('click', ()=>{
  const texto = document.getElementById('kb-texto').value.trim();
  if(!texto){
    alert('Digite ou cole uma informação antes de analisar.');
    return;
  }
  lastAnalysis = analyzeText(texto);
  renderAnalysis(lastAnalysis);
});

document.getElementById('kb-cancelar-btn').addEventListener('click', resetKbForm);

document.getElementById('kb-salvar-btn').addEventListener('click', ()=>{
  const texto = document.getElementById('kb-texto').value.trim();
  const titulo = document.getElementById('kb-titulo').value.trim() || texto.slice(0,60);
  const categoria = document.getElementById('kb-categoria-final').value;
  if(!texto){ return; }

  const btn = document.getElementById('kb-salvar-btn');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  addKbEntry({
    titulo, texto, categoria,
    tabelas: lastAnalysis ? lastAnalysis.detectedTables.map(d=>d.tabela) : [],
    confianca: lastAnalysis ? lastAnalysis.confidence : 0,
    data: new Date().toISOString()
  }).then(()=>{
    resetKbForm();
    goToView('conhecimento');
  }).catch(err=>{
    console.error(err);
    alert('Não consegui salvar na base compartilhada. Verifique sua conexão ou as regras do Firestore.');
  }).finally(()=>{
    btn.disabled = false;
    btn.textContent = '✓ Salvar na Base de Conhecimento';
  });
});

// ---------- board (Base de Conhecimento) ----------
let kbSearch = '';
function renderKbBoard(){
  const board = document.getElementById('kb-board');
  board.innerHTML = '';
  const list = loadKB();
  const q = kbSearch.trim().toLowerCase();

  PROCESS_CATEGORIES.forEach(cat=>{
    const items = list.filter(e=>{
      if(e.categoria !== cat.id) return false;
      if(!q) return true;
      return (e.titulo+' '+e.texto).toLowerCase().includes(q);
    });

    const col = document.createElement('div');
    col.className = 'kb-col';
    col.innerHTML = `
      <div class="kb-col-head">
        <span class="dot" style="background:${cat.cor};"></span>
        ${cat.label}
        <span class="n">${items.length}</span>
      </div>
      <div class="kb-col-body"></div>
    `;
    const body = col.querySelector('.kb-col-body');

    if(items.length === 0){
      body.innerHTML = '<div class="kb-empty">nada registrado ainda</div>';
    } else {
      items.forEach(entry=>{
        const el = document.createElement('div');
        el.className = 'kb-entry';
        const dt = new Date(entry.data);
        el.innerHTML = `
          <div class="tt">${entry.titulo}</div>
          <div class="tx">${entry.texto}</div>
          <div class="meta">
            ${(entry.tabelas||[]).slice(0,4).map(t=>`<span class="tg">${t}</span>`).join('')}
          </div>
        `;
        el.onclick = ()=> openKbDrawer(entry);
        body.appendChild(el);
      });
    }
    board.appendChild(col);
  });
}

document.getElementById('kb-search').addEventListener('input', e=>{
  kbSearch = e.target.value;
  renderKbBoard();
});

function openKbDrawer(entry){
  const cat = catInfo(entry.categoria);
  const content = document.getElementById('drawer-content');
  const dt = new Date(entry.data);
  content.innerHTML = `
    <div class="module-tag" style="color:${cat.cor};">${cat.label}</div>
    <h3 style="margin-top:8px;">${entry.titulo}</h3>
    <div style="color:var(--text-faint);font-size:11px;font-family:var(--mono);margin-bottom:14px;">
      ${dt.toLocaleDateString('pt-BR')} · confiança da IA: ${entry.confianca}%
    </div>
    <div style="color:var(--text-dim);font-size:13px;line-height:1.6;white-space:pre-wrap;">${entry.texto}</div>

    ${entry.tabelas && entry.tabelas.length ? `
      <div class="drawer-section">
        <h4>Tabelas relacionadas</h4>
        <div class="detected-tags">
          ${entry.tabelas.map(t=>`<span class="rel-badge" style="cursor:pointer;" data-code="${t}">${t}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    <div class="drawer-section">
      <button class="btn ghost small" id="kb-delete-btn">Excluir esta informação</button>
    </div>
  `;
  content.querySelectorAll('[data-code]').forEach(el=>{
    el.onclick = ()=> openDrawer(el.dataset.code);
  });
  content.querySelector('#kb-delete-btn').onclick = ()=>{
    if(confirm('Excluir esta informação da base de conhecimento? Isso remove pra todo mundo que usa o Hub.')){
      deleteKbEntry(entry.id).then(()=>{
        closeDrawer();
      }).catch(err=>{
        console.error(err);
        alert('Não consegui excluir. Verifique sua conexão ou as regras do Firestore.');
      });
    }
  };
  document.getElementById('drawer').classList.add('show');
  document.getElementById('drawer-backdrop').classList.add('show');
}

// ---------- export / import ----------
document.getElementById('kb-export-btn').addEventListener('click', ()=>{
  const list = loadKB();
  const blob = new Blob([JSON.stringify(list, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wms-hub-base-conhecimento.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('kb-import-btn').addEventListener('click', ()=>{
  document.getElementById('kb-import-file').click();
});
document.getElementById('kb-import-file').addEventListener('change', e=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const imported = JSON.parse(reader.result);
      if(!Array.isArray(imported)) throw new Error('formato inválido');
      const batch = db.batch();
      imported.forEach(entry=>{
        const ref = db.collection(KB_COLLECTION).doc(); // novo ID, evita colisão
        const { id, ...rest } = entry; // não reaproveita o id antigo (localStorage)
        batch.set(ref, rest);
      });
      batch.commit().then(()=>{
        alert('Base de conhecimento importada com sucesso (' + imported.length + ' registro(s)).');
      }).catch(err=>{
        console.error(err);
        alert('Não consegui importar pra base compartilhada. Verifique as regras do Firestore.');
      });
    }catch(err){
      alert('Não consegui ler esse arquivo. Confirme se é um JSON exportado daqui mesmo.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ---------- init ----------
fillStats();
initKbListener();
goToView('home');

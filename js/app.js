function toggleTheme(){
  const isDarkMode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
  const btn = document.querySelector('.theme-toggle');
  if(btn) btn.textContent = isDarkMode ? '☀️' : '🌙';
}

function initTheme(){
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  if(isDarkMode){
    document.body.classList.add('dark-mode');
    const btn = document.querySelector('.theme-toggle');
    if(btn) btn.textContent = '☀️';
  }
}

window.addEventListener('DOMContentLoaded', initTheme);

function fecharSplash(){
  const splash = document.getElementById('splashScreen');
  if(splash) splash.classList.add('hide');
}
window.addEventListener('load', () => setTimeout(fecharSplash, 2300));
document.addEventListener('click', (ev) => {
  const splash = document.getElementById('splashScreen');
  if(splash && !splash.classList.contains('hide') && splash.contains(ev.target)) fecharSplash();
});

// POLARIZAÇÃO: Abaixo de 99.49 é Não Conforme (Limite Mínimo para VHP)
// COR, CINZAS, UMIDADE, INSOLÚVEL: Acima do limite é Não Conforme (Limite Máximo)
const ESPEC = {corMax:1200, polarMin:99.49, cinzasMax:0.15, umidadeMax:0.15, insolMax:500};
const STORE = 'coq_boletins_v1';
const SEQ_PREFIX = 'coq_seq_';
let categoriaAtual = 'Navio';
let ultimoSalvo = null;

const memoriaStorage = {};
let storagePersistenteAtivo = false;
const armazenamento = (() => {
  try {
    const teste = '__coq_storage_test__';
    window.localStorage.setItem(teste, '1');
    window.localStorage.removeItem(teste);
    storagePersistenteAtivo = true;
    return window.localStorage;
  } catch (erro) {
    console.warn('COQ: localStorage bloqueado; usando armazenamento temporário da sessão.', erro);
    return {
      getItem: chave => Object.prototype.hasOwnProperty.call(memoriaStorage, chave) ? memoriaStorage[chave] : null,
      setItem: (chave, valor) => { memoriaStorage[chave] = String(valor); },
      removeItem: chave => { delete memoriaStorage[chave]; }
    };
  }
})();

const $ = id => document.getElementById(id);
function anoAtual(){return new Date().getFullYear();}
function anoCurto(){return String(anoAtual()).slice(-2);}

function lerJSONSeguro(chave, padrao){
  try {
    const valor = armazenamento.getItem(chave);
    return valor ? JSON.parse(valor) : padrao;
  } catch (erro) {
    console.warn('COQ: falha ao ler dados; base reiniciada para esta sessão.', erro);
    return padrao;
  }
}

function getBase(){return lerJSONSeguro(STORE, []);}
function setBase(arr){armazenamento.setItem(STORE, JSON.stringify(arr));}
function proximoNumeroPreview(){const ano=anoAtual(); const seq=Number(armazenamento.getItem(SEQ_PREFIX+ano)||0)+1; return String(seq).padStart(4,'0')+'/'+anoCurto();}
function gerarNumero(){const ano=anoAtual(); const seq=Number(armazenamento.getItem(SEQ_PREFIX+ano)||0)+1; armazenamento.setItem(SEQ_PREFIX+ano, seq); return String(seq).padStart(4,'0')+'/'+anoCurto();}

function atualizarPreview(){
  const prox = $('proximoBoletim');
  if(prox) prox.textContent = 'Próximo boletim: '+proximoNumeroPreview();
  const aviso = $('avisoStorageTemporario');
  if(aviso) aviso.style.display = storagePersistenteAtivo ? 'none' : 'block';
}

function setCategoria(cat){
  categoriaAtual = cat;
  const badge = $('categoriaAtualBadge');
  if(badge) badge.textContent = cat;
  document.querySelectorAll('.cat').forEach(c=>c.classList.toggle('active', c.dataset.cat===cat));
  
  const periodoDiv = document.getElementById('periodoDiv');
  if(periodoDiv){
    periodoDiv.style.display = (cat === 'Compostas de Período') ? 'block' : 'none';
  }
  
  const labels = {Navio:'Navio / viagem', 'Caminhão Extra':'Placa / carregamento', Ferrovia:'Prefixo da composição', Armazém:'Lote / armazém', 'Compostas de Período':'Período de coleta'};
  const hints = {Navio:'Informe o nome do navio ou viagem.', 'Caminhão Extra':'Informe a placa do caminhão ou código do carregamento.', Ferrovia:'Informe o prefixo da composição no padrão XXX-XXXXXX-XX.', Armazém:'Informe armazém, lote ou pilha.', 'Compostas de Período':'Selecione o período (M1, M2, M3, M4 ou Moegão)'};
  
  const lbl = $('identificacaoLabel'); if(lbl) lbl.textContent = labels[cat] || 'Identificação';
  const hnt = $('identificacaoHint'); if(hnt) hnt.textContent = hints[cat] || '';
  atualizarDestaqueCampos();
}

function v(id){const el=$(id); return el ? el.value.trim() : '';}
function somenteDigitos(txt){return String(txt||'').replace(/\D/g,'');}

function formatarInteiro(id, maxDigits, semZeroEsquerda=true){
  const el=$(id); if(!el) return '';
  let d=somenteDigitos(el.value).slice(0,maxDigits);
  if(semZeroEsquerda) d=d.replace(/^0+(?=\d)/,'');
  el.value=d; return d;
}

function formatarDecimal2(id){
  const el=$(id); if(!el) return '';
  let d=somenteDigitos(el.value).slice(0,4);
  if(!d){el.value=''; return '';}
  if(d.length<=2) d=d.padStart(3,'0');
  const inteiro=d.slice(0,-2).replace(/^0+(?=\d)/,'') || '0';
  el.value=inteiro+','+d.slice(-2); return el.value;
}

function valorNumero(id){const txt=v(id); if(!txt) return null; const x=Number(txt.replace(',','.')); return isNaN(x) ? null : x;}

function formatarPrefixoFerrovia(){
  if(categoriaAtual!=='Ferrovia') return;
  const el=$('identificacao'); if(!el) return;
  const d=somenteDigitos(el.value).slice(0,11);
  let out=d.slice(0,3); if(d.length>3) out+='-'+d.slice(3,9); if(d.length>9) out+='-'+d.slice(9,11);
  el.value=out;
}

function analisesForaEspecificacao(b){
  const falhas=[];
  if(b.cor!==null && b.cor>ESPEC.corMax) falhas.push('Cor');
  if(b.polarizacao!==null && b.polarizacao<ESPEC.polarMin) falhas.push('Polarização'); // Corrigido: POL inferior ao mínimo
  if(b.cinzas!==null && b.cinzas>ESPEC.cinzasMax) falhas.push('Cinzas');
  if(b.umidade!==null && b.umidade>ESPEC.umidadeMax) falhas.push('Umidade');
  if(b.insoluvel!==null && b.insoluvel>ESPEC.insolMax) falhas.push('Resíduo insolúvel');
  return falhas;
}

function atualizarDestaqueCampos(){
  const regras = [
    ['cor', ESPEC.corMax, 'max'], 
    ['polarizacao', ESPEC.polarMin, 'min'], 
    ['cinzas', ESPEC.cinzasMax, 'max'], 
    ['umidade', ESPEC.umidadeMax, 'max'], 
    ['insoluvel', ESPEC.insolMax, 'max']
  ];
  for(const [id, limite, tipo] of regras){
    const el = $(id); if(!el) continue;
    const valor = valorNumero(id);
    if(valor === null){
      el.classList.remove('fora-espec');
      continue;
    }
    const fora = tipo === 'max' ? (valor > limite) : (valor < limite);
    el.classList.toggle('fora-espec', fora);
  }
}

function notificar(mensagem, tipo='info', titulo='Controle Operacional de Qualidade'){
  const stack = $('toastStack');
  if(!stack){ console.log(titulo+': '+mensagem); return; }
  const toast = document.createElement('div');
  toast.className = 'toast '+tipo;
  toast.setAttribute('role', tipo==='error' ? 'alert' : 'status');
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label','Fechar notificação');
  close.textContent = '×';
  toast.innerHTML = `<div><strong>${titulo}</strong><span>${mensagem}</span></div>`;
  toast.appendChild(close);
  close.addEventListener('click', ()=>toast.remove());
  stack.appendChild(toast);
  setTimeout(()=>{ if(toast.isConnected) toast.remove(); }, tipo==='error' ? 6500 : 4200);
}

function avisar(mensagem, tipo='info', titulo='Controle Operacional de Qualidade'){
  notificar(mensagem, tipo, titulo);
  return false;
}
let limparBancoPendenteAte = 0;

function coletarDados(comNumero=false){
  if(categoriaAtual==='Ferrovia') formatarPrefixoFerrovia();
  ['cor','insoluvel'].forEach(id=>formatarInteiro(id, id==='cor'?4:5, true));
  ['polarizacao','cinzas','umidade'].forEach(id=>formatarDecimal2(id));
  
  if(!v('identificacao')){avisar('Informe a identificação principal.', 'warning', 'Validação'); return null;}
  if(categoriaAtual==='Ferrovia' && !/^\d{3}-\d{6}-\d{2}$/.test(v('identificacao'))){
    avisar('Para Ferrovia, informe o prefixo da composição no padrão XXX-XXXXXX-XX.', 'warning', 'Validação'); 
    return null;
  }
  
  const responsavelAtual = v('responsavel') || 'Luis Claudio';
  
  const b = {
    id: Date.now(), 
    numero: comNumero ? gerarNumero() : '', 
    data: new Date().toLocaleString('pt-BR'), 
    categoria: categoriaAtual,
    identificacao: v('identificacao'), 
    prefixoComposicao: categoriaAtual==='Ferrovia' ? v('identificacao') : '', 
    localOrigem: v('localOrigem'), 
    destino: v('destino'), 
    produto: v('produto')||'VHP', 
    quantidade: v('quantidade'), 
    responsavel: responsavelAtual, 
    observacoes: v('observacoes'),
    cor: valorNumero('cor'), 
    polarizacao: valorNumero('polarizacao'), 
    cinzas: valorNumero('cinzas'), 
    umidade: valorNumero('umidade'), 
    insoluvel: valorNumero('insoluvel'), 
    corTexto: v('cor'), 
    polarizacaoTexto: v('polarizacao'), 
    cinzasTexto: v('cinzas'), 
    umidadeTexto: v('umidade'), 
    insoluvelTexto: v('insoluvel'), 
    residuoMineral: v('residuoMineral'), 
    situacao: v('situacao')
  };
  
  b.falhas = analisesForaEspecificacao(b);
  b.status = b.falhas.length ? 'Não conforme: '+b.falhas.join(', ') : v('situacao');
  atualizarDestaqueCampos();
  return b;
}

function salvarBoletim(){
  const b = coletarDados(true); if(!b) return;
  const base = getBase(); base.push(b); setBase(base); ultimoSalvo = b; limparFormulario(false); render();
  notificar('Boletim de Análises '+b.numero+' salvo. Use o botão PDF se desejar gerar o documento.', 'success', 'Boletim salvo');
}

function limparFormulario(resetCat=true){
  ['identificacao','localOrigem','destino','quantidade','observacoes','cor','polarizacao','cinzas','umidade','insoluvel','residuoMineral'].forEach(id=>{
    const el = $(id); if(el) el.value='';
  });
  const resp = $('responsavel'); if(resp) resp.value='Luis Claudio';
  ['cor','polarizacao','cinzas','umidade','insoluvel'].forEach(id=>{
    const el = $(id); if(el) el.classList.remove('fora-espec');
  }); 
  const prod = $('produto'); if(prod) prod.value='VHP'; 
  const sit = $('situacao'); if(sit) sit.value='Conforme'; 
  if(resetCat) setCategoria('Navio');
}

function render(){
  const base = getBase().sort((a,b)=>b.id-a.id); 
  const tb=$('tbodyHistorico'); if(!tb) return;
  tb.innerHTML='';
  
  for(const b of base){
    const tr=document.createElement('tr');
    const falhas = b.falhas || analisesForaEspecificacao(b);
    tr.title = falhas.length ? 'Fora de especificação: '+falhas.join(', ') : '';
    tr.innerHTML = `<td><b>${b.numero}</b></td><td>${b.data}</td><td>${b.categoria}</td><td>${b.identificacao}</td><td>${b.produto}</td><td>${b.quantidade||'-'}</td><td class="${falhas.length || b.status.startsWith('Não')?'bad':'ok'}">${b.status}</td><td><button type="button" class="btn primary" style="padding:6px 8px" onclick="gerarPDFPorId(${b.id})">PDF</button> <button type="button" class="btn outline" style="padding:6px 8px" onclick="enviarWhatsAppPorId(${b.id})">WhatsApp</button> <button type="button" class="btn outline" style="padding:6px 8px" onclick="enviarEmailPorId(${b.id})">Email</button></td>`;
    tb.appendChild(tr);
  }
  
  if($('totalRegistros')) $('totalRegistros').textContent = base.length+' registros';
  if($('kpiNavio')) $('kpiNavio').textContent = base.filter(b=>b.categoria==='Navio').length;
  if($('kpiCaminhao')) $('kpiCaminhao').textContent = base.filter(b=>b.categoria==='Caminhão Extra').length;
  if($('kpiFerrovia')) $('kpiFerrovia').textContent = base.filter(b=>b.categoria==='Ferrovia').length;
  if($('kpiArmazem')) $('kpiArmazem').textContent = base.filter(b=>b.categoria==='Armazém').length;
  if($('kpiLab')) $('kpiLab').textContent = base.filter(b=>b.categoria==='Laboratório').length;
  atualizarPreview();
}

function achar(id){return getBase().find(b=>b.id===id);} 
function gerarPDFPorId(id){const b=achar(id); if(b) gerarPDF(b);} 
function enviarWhatsAppPorId(id){const b=achar(id); if(b) enviarWhatsApp(b);}
function enviarEmailPorId(id){const b=achar(id); if(b) enviarEmail(b);} 

function gerarPDFUltimo(){const b=ultimoSalvo || getBase().sort((a,b)=>b.id-a.id)[0]; if(!b) return avisar('Nenhum Boletim de Análises salvo.', 'warning'); gerarPDF(b);} 
function enviarWhatsAppUltimo(){const b=ultimoSalvo || getBase().sort((a,b)=>b.id-a.id)[0]; if(!b) return avisar('Nenhum Boletim de Análises salvo.', 'warning'); enviarWhatsApp(b);}
function enviarEmailUltimo(){const b=ultimoSalvo || getBase().sort((a,b)=>b.id-a.id)[0]; if(!b) return avisar('Nenhum Boletim de Análises salvo.', 'warning'); enviarEmail(b);}

function fmt(x, fallback='-'){return (x===null || x===undefined || x==='') ? fallback : String(x).replace('.',',');}

function gerarPDF(b){
  const {jsPDF}=window.jspdf; const doc=new jsPDF('p','mm','a4'); const W=210;
  const idLabel = b.categoria==='Ferrovia' ? 'Prefixo da composição' : 'Identificação';
  doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(100); doc.text('SGS', 15, 19);
  doc.setTextColor(15); doc.setFontSize(14); doc.text('Boletim de Análises', W/2, 18, {align:'center'});
  doc.setFontSize(9); doc.text('Nº Boletim', 150, 11); doc.setFont('helvetica','normal'); doc.text(b.numero, 182, 11); doc.setFont('helvetica','bold'); doc.text('Emissão', 150, 18); doc.setFont('helvetica','normal'); doc.text(b.data.split(',')[0], 182, 18); doc.setFont('helvetica','bold'); doc.text('Página', 150, 25); doc.setFont('helvetica','normal'); doc.text('1/1', 182, 25);
  doc.rect(10,7,190,22); doc.line(42,7,42,29); doc.line(145,7,145,29); doc.line(145,14,200,14); doc.line(145,21,200,21);
  doc.setFontSize(7); doc.text(`O presente Boletim de Análises registra os resultados da amostra/operação ${b.identificacao}, produto ${b.produto}.`, W/2, 35, {align:'center'});
  const info = `Categoria: ${b.categoria} | ${idLabel}: ${b.identificacao} | Local/Origem: ${b.localOrigem||'-'} | Destino: ${b.destino||'-'} | Quantidade: ${b.quantidade||'-'}`;
  doc.text(info, 12, 41, {maxWidth:186});
  doc.text(`Analista: ${b.responsavel||'-'}`, 12, 47, {maxWidth:186});
  doc.text(`Observações: ${b.observacoes||'Sem observações.'}`, 12, 53, {maxWidth:186});
  
  doc.autoTable({startY:61, margin:{left:35,right:35}, head:[['ENSAIOS','UNIDADE','VHP']], body:[['POLARIZAÇÃO','ºZ','Mín. 99,49'],['UMIDADE','%','Máx. 0,15'],['CINZAS','%','Máx. 0,15'],['COR','UI','Máx. 1200'],['RESÍDUO INSOLÚVEL','mg/kg','Máx. 500']], styles:{fontSize:7,cellPadding:1.5,halign:'center'}, headStyles:{fillColor:[250,204,21],textColor:[0,0,0]}, columnStyles:{0:{fillColor:[250,204,21],fontStyle:'bold'}}});
  doc.autoTable({startY:doc.lastAutoTable.finalY+5, margin:{left:35,right:35}, head:[['ENSAIOS','UNIDADE','METODOLOGIA']], body:[['POLARIZAÇÃO','ºZ','GS 1/2/3/9-1'],['UMIDADE','%','GS 2/1/3/9-15:2007'],['CINZAS','%','GS 1/3/4/7/8-11:1994'],['COR','UI','GS 1/3/7/8-7:2011'],['RESÍDUO INSOLÚVEL','mg/kg','GS 2/3/9-19:2007']], styles:{fontSize:7,cellPadding:1.5,halign:'center'}, headStyles:{fillColor:[250,204,21],textColor:[0,0,0]}, columnStyles:{0:{fillColor:[250,204,21],fontStyle:'bold'}}});
  
  doc.autoTable({
    startY:doc.lastAutoTable.finalY+7, 
    head:[[idLabel.toUpperCase(),'COR','POL','UMIDADE','CINZAS','RESÍDUO INSOLÚVEL','RESÍDUO MINERAL']], 
    body:[[b.identificacao, b.corTexto||fmt(b.cor), b.polarizacaoTexto||fmt(b.polarizacao), b.umidadeTexto||fmt(b.umidade), b.cinzasTexto||fmt(b.cinzas), b.insoluvelTexto||fmt(b.insoluvel), b.residuoMineral||'-']], 
    styles:{fontSize:7,cellPadding:2,halign:'center'}, 
    headStyles:{fillColor:[250,204,21],textColor:[0,0,0]}, 
    didParseCell:(data)=>{ 
      if(data.section==='body'){ 
        const fora={
          1: b.cor!==null && b.cor>ESPEC.corMax,
          2: b.polarizacao!==null && b.polarizacao<ESPEC.polarMin, // Ajustado condicional da POL
          3: b.umidade!==null && b.umidade>ESPEC.umidadeMax,
          4: b.cinzas!==null && b.cinzas>ESPEC.cinzasMax,
          5: b.insoluvel!==null && b.insoluvel>ESPEC.insolMax
        }; 
        if(fora[data.column.index]){data.cell.styles.textColor=[220,38,38]; data.cell.styles.fontStyle='bold';} 
      } 
    }
  });
  
  let y=doc.lastAutoTable.finalY+8; doc.setFont('helvetica','bold'); doc.text('CONCLUSÃO:', 12, y); doc.setFont('helvetica','normal'); doc.text(`Resultado: ${b.status}. O resultado refere-se exclusivamente à amostra/operação identificada neste boletim.`, 12, y+5, {maxWidth:186});
  y+=18; doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.text('Analista: '+(b.responsavel||'Luis Claudio'), 12, y, {maxWidth:186});
  doc.setFontSize(6); doc.text('Modelo gerado pelo Controle Operacional de Qualidade — validar logotipo e dados oficiais antes de emissão externa.', W/2, 287, {align:'center'});
  doc.save(`Boletim_de_Analises_${b.numero.replace('/','-')}_${b.identificacao.replace(/[^a-z0-9]/gi,'_')}.pdf`);
}

function mensagemWhatsApp(b){
  const idLabel = b.categoria==='Ferrovia' ? 'Prefixo da composição' : 'Identificação';
  const falhas = b.falhas || analisesForaEspecificacao(b);
  const marca = nome => falhas.includes(nome) ? '  *FORA DA ESPECIFICAÇÃO*' : '';
  const linhas = [
    `*Boletim de Análises ${b.numero} - ${b.categoria}*`,
    `${idLabel}: ${b.identificacao}`,
    `Local/Origem: ${b.localOrigem||'-'}`,
    `Destino/Cliente: ${b.destino||'-'}`,
    `Produto: ${b.produto||'VHP'}`,
    `Quantidade: ${b.quantidade||'-'}`,
    '',
    '*Resultados:*',
    `Cor: ${b.corTexto||fmt(b.cor)} UI ${marca('Cor')}`,
    `Pol: ${b.polarizacaoTexto||fmt(b.polarizacao)} ºZ ${marca('Polarização')}`,
    `Cinzas: ${b.cinzasTexto||fmt(b.cinzas)} % ${marca('Cinzas')}`,
    `Umidade: ${b.umidadeTexto||fmt(b.umidade)} % ${marca('Umidade')}`,
    `Resíduo insolúvel: ${b.insoluvelTexto||fmt(b.insoluvel)} mg/kg ${marca('Resíduo insolúvel')}`,
    `Resíduo mineral: ${b.residuoMineral||'-'}`,
    '',
    `*Status:* ${b.status}`,
    `Analista: ${b.responsavel||'Luis Claudio'}`
  ];
  if(b.observacoes) linhas.push('', `Observações: ${b.observacoes}`);
  return linhas.join('\n');
}

function enviarWhatsApp(b){ const msg=encodeURIComponent(mensagemWhatsApp(b)); const janela=window.open('https://wa.me/?text='+msg, '_blank'); if(janela){notificar('Mensagem preparada em uma nova aba do WhatsApp.', 'success', 'WhatsApp');} else {avisar('O navegador bloqueou a nova aba do WhatsApp. Verifique o bloqueador de pop-ups.', 'warning', 'WhatsApp');} }
function enviarEmail(b){ const msg=mensagemWhatsApp(b); const assunto=encodeURIComponent('Boletim de Análises '+b.numero+' - '+b.categoria); const corpo=encodeURIComponent(msg); const link='mailto:?subject='+assunto+'&body='+corpo; window.location.href=link; notificar('Email preparado no seu cliente de email.', 'success', 'Email'); }
function csvSafe(x){return '"'+String(x??'').replaceAll('"','""')+'"';}

function exportarCSV(){
  const base=getBase(); if(!base.length) return avisar('Nenhum Boletim de Análises para exportar.', 'warning');
  const cols=['numero','data','categoria','identificacao','prefixoComposicao','localOrigem','destino','produto','quantidade','responsavel','corTexto','polarizacaoTexto','cinzasTexto','umidadeTexto','insoluvelTexto','residuoMineral','status','observacoes'];
  const csv=[cols.join(';'), ...base.map(b=>cols.map(c=>csvSafe(b[c])).join(';'))].join('\n');
  baixarArquivo(csv, 'boletins_analise_COQ.csv', 'text/csv;charset=utf-8;');
}

// ═══════════════════════════════════════════════════════════
// FERRAMENTAS LABORATORIAIS INTEGRADAS
// ═══════════════════════════════════════════════════════════
let timerEstufaInterval = null;
let timerEstufaAlarmeInterval = null;
let timerEstufaRestante = 0;
let timerEstufaPausado = false;
let audioCtxEstufa = null;

function parseDecimalBR(valor){
  const n = Number(String(valor||'').replace(',','.'));
  return Number.isFinite(n) ? n : NaN;
}

function calcularCorICUMSA(){
  const cubeta = parseFloat(document.getElementById('cubetaICUMSA')?.value || '1');
  const absorbancia = parseFloat(document.getElementById('absorbanciaICUMSA')?.value || '0');
  if(!Number.isFinite(absorbancia) || absorbancia < 0){
    avisar('Informe um valor válido de absorbância.', 'warning', 'Cor ICUMSA');
    return;
  }
  const divisor = cubeta === 1 ? 0.2 : 0.8;
  const cor = Math.round((absorbancia / divisor) * 1000);
  const res = document.getElementById('resultadoCorICUMSA');
  if(res) res.textContent = String(cor);
}

function inserirCorICUMSA(){
  const c = document.getElementById('resultadoCorICUMSA')?.textContent;
  if(!c || c==='-'){
    avisar('Calcule a cor ICUMSA primeiro.', 'warning', 'Cor ICUMSA');
    return;
  }
  const target = document.getElementById('cor');
  if(target){
    target.value = c;
    formatarInteiro('cor', 4, true);
    notificar('Cor ICUMSA inserida no Boletim de Análises.', 'success', 'Cor ICUMSA');
    atualizarDestaqueCampos();
  }
}

function calcularResiduoInsoluvelDuplicata(){
  const membranaVazia = parseDecimalBR(document.getElementById('membranaVazia')?.value || '0');
  const membranaResiduoDuplicata = parseDecimalBR(document.getElementById('membranaResiduoDuplicata')?.value || '0');
  const massaAcucar = parseDecimalBR(document.getElementById('massaAcucarDuplicata')?.value || '125');
  
  if(!Number.isFinite(membranaVazia) || !Number.isFinite(membranaResiduoDuplicata) || !Number.isFinite(massaAcucar) || massaAcucar <= 0){
    avisar('Preencha todos os campos com valores válidos.', 'warning', 'Resíduo insolúvel duplicata');
    return;
  }
  
  const diferenca = membranaResiduoDuplicata - membranaVazia;
  if(diferenca < 0){
    avisar('Membrana + resíduo deve ser maior que membrana vazia.', 'warning', 'Resíduo insolúvel duplicata');
    return;
  }
  
  const residuoMgKg = Math.round((diferenca / massaAcucar) * 1000000);
  const res = document.getElementById('resultadoResiduoInsoluvelDuplicata');
  if(res) res.textContent = String(residuoMgKg);
}

function inserirResiduoInsoluvelDuplicata(){
  const r = document.getElementById('resultadoResiduoInsoluvelDuplicata')?.textContent;
  if(!r || r==='-'){
    avisar('Calcule o resíduo insolúvel duplicata primeiro.', 'warning', 'Resíduo insolúvel duplicata');
    return;
  }
  const target = document.getElementById('insoluvel');
  if(target){
    target.value = r;
    formatarInteiro('insoluvel', 5, true);
    notificar('Resíduo insolúvel inserido no Boletim de Análises.', 'success', 'Resíduo insolúvel duplicata');
    atualizarDestaqueCampos();
  }
}

function formatarTempoEstufa(segundos){
  const m = Math.floor(segundos/60);
  const s = segundos % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function tocarBeepEstufa(){
  try{
    if(!audioCtxEstufa) audioCtxEstufa = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtxEstufa.state === 'suspended') audioCtxEstufa.resume();
    const osc = audioCtxEstufa.createOscillator();
    const gain = audioCtxEstufa.createGain();
    osc.type = 'sine'; osc.frequency.value = 880; gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(audioCtxEstufa.destination); osc.start();
    setTimeout(()=>{osc.stop(); osc.disconnect(); gain.disconnect();}, 260);
  }catch(e){}
}

function atualizarBotoesTimerEstufa(estado){
  if($('btnTimerIniciar')) $('btnTimerIniciar').classList.toggle('hidden', estado==='rodando' || estado==='alarme');
  if($('btnTimerPausar')) $('btnTimerPausar').classList.toggle('hidden', estado!=='rodando');
  if($('btnTimerResetar')) $('btnTimerResetar').classList.toggle('hidden', estado==='inicial');
  if($('btnTimerAlarme')) $('btnTimerAlarme').classList.toggle('hidden', estado!=='alarme');
}

function iniciarTimerEstufa(){
  if(timerEstufaPausado && timerEstufaRestante > 0){
    timerEstufaPausado = false;
    if($('btnTimerIniciar')) $('btnTimerIniciar').textContent = 'Iniciar';
    atualizarBotoesTimerEstufa('rodando');
    return;
  }
  const min = parseInt($('timerEstufaMinutos').value, 10);
  if(!Number.isFinite(min) || min <= 0){avisar('Informe um tempo válido em minutos.', 'warning', 'Timer da estufa'); return;}
  clearInterval(timerEstufaInterval); clearInterval(timerEstufaAlarmeInterval);
  timerEstufaRestante = min * 60;
  timerEstufaPausado = false;
  if($('timerEstufaMinutos')) $('timerEstufaMinutos').readOnly = true;
  if($('timerEstufaDisplay')){
    $('timerEstufaDisplay').classList.remove('done');
    $('timerEstufaDisplay').textContent = formatarTempoEstufa(timerEstufaRestante);
  }
  atualizarBotoesTimerEstufa('rodando');
  tocarBeepEstufa();
  timerEstufaInterval = setInterval(atualizarTimerEstufa, 1000);
}

function pausarTimerEstufa(){
  timerEstufaPausado = true;
  if($('btnTimerIniciar')) $('btnTimerIniciar').textContent = 'Retomar';
  atualizarBotoesTimerEstufa('pausado');
}

function atualizarTimerEstufa(){
  if(timerEstufaPausado) return;
  if(timerEstufaRestante <= 0){
    clearInterval(timerEstufaInterval); timerEstufaInterval = null;
    if($('timerEstufaDisplay')){
      $('timerEstufaDisplay').textContent = '00:00';
      $('timerEstufaDisplay').classList.add('done');
    }
    atualizarBotoesTimerEstufa('alarme');
    if(!timerEstufaAlarmeInterval){timerEstufaAlarmeInterval = setInterval(tocarBeepEstufa, 1500); tocarBeepEstufa();}
    return;
  }
  timerEstufaRestante--;
  if($('timerEstufaDisplay')) $('timerEstufaDisplay').textContent = formatarTempoEstufa(timerEstufaRestante);
}

function resetarTimerEstufa(){
  clearInterval(timerEstufaInterval); clearInterval(timerEstufaAlarmeInterval);
  timerEstufaInterval = null; timerEstufaAlarmeInterval = null; timerEstufaRestante = 0; timerEstufaPausado = false;
  if($('timerEstufaMinutos')){ $('timerEstufaMinutos').readOnly = false; $('timerEstufaMinutos').value = ''; }
  if($('timerEstufaDisplay')){ $('timerEstufaDisplay').textContent = '00:00'; $('timerEstufaDisplay').classList.remove('done'); }
  if($('btnTimerIniciar')) $('btnTimerIniciar').textContent = 'Iniciar'; 
  atualizarBotoesTimerEstufa('inicial');
}

function pararAlarmeEstufa(){
  clearInterval(timerEstufaAlarmeInterval); timerEstufaAlarmeInterval = null;
  notificar('Alarme da estufa desligado.', 'success', 'Timer da estufa');
  resetarTimerEstufa();
}

function passagemDeTurno(){
  const base = getBase();
  if(!base.length){
    return avisar('Nenhum boletim registrado para passagem de turno.', 'warning', 'Passagem de turno');
  }
  
  const hoje = new Date().toLocaleDateString('pt-BR');
  const boletinsHoje = base.filter(b => b.data.includes(hoje));
  
  if(!boletinsHoje.length){
    return avisar('Nenhum boletim de hoje para passagem de turno.', 'warning', 'Passagem de turno');
  }
  
  const feitos = boletinsHoje.filter(b => b.status === 'Conforme' || !b.status.startsWith('Não'));
  const naoConformes = boletinsHoje.filter(b => b.status.startsWith('Não'));
  
  const analistaResponsavel = v('responsavel') || 'Luis Claudio';
  
  const linhas = [
    '📊 *PASSAGEM DE TURNO - ' + hoje + '*',
    '',
    '✅ *AMOSTRAS FEITAS (*' + feitos.length + '*):*',
    ...feitos.map(b => '• ' + b.identificacao + ' - ' + b.produto),
    '',
    '❌ *NÃO CONFORMES (*' + naoConformes.length + '*):*',
    ...naoConformes.map(b => '• ' + b.identificacao + ' - ' + b.produto + ' (' + b.status + ')'),
    '',
    `*Analista:* ${analistaResponsavel}`,
    '*Hora:* ' + new Date().toLocaleTimeString('pt-BR')
  ];
  
  const msg = encodeURIComponent(linhas.join('\n'));
  const janela = window.open('https://wa.me/?text=' + msg, '_blank');
  if(janela){
    notificar('Passagem de turno preparada no WhatsApp.', 'success', 'Passagem de turno');
  } else {
    avisar('O navegador bloqueou a nova aba. Verifique o bloqueador de pop-ups.', 'warning', 'WhatsApp');
  }
}

function baixarBackup(){baixarArquivo(JSON.stringify(getBase(),null,2),'backup_COQ.json','application/json');}

function baixarArquivo(conteudo,nome,tipo){
  const blob=new Blob([conteudo],{type:tipo}); 
  const url=URL.createObjectURL(blob); 
  const a=document.createElement('a'); 
  a.href=url; a.download=nome; a.style.display='none'; 
  document.body.appendChild(a); a.click(); 
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();}, 800); 
  notificar('Arquivo '+nome+' gerado para download.', 'success', 'Exportação');
}

function limparBanco(){
  const agora=Date.now(); 
  if(agora>limparBancoPendenteAte){
    limparBancoPendenteAte=agora+8000; 
    return avisar('Clique novamente em Limpar base local nos próximos 8 segundos para confirmar a exclusão dos boletins deste navegador.', 'warning', 'Confirmação necessária');
  } 
  armazenamento.removeItem(STORE); 
  limparBancoPendenteAte=0; 
  ultimoSalvo=null; 
  render(); 
  atualizarPreview(); 
  notificar('Base local limpa com sucesso.', 'success', 'Base local');
  if($('responsavel')) $('responsavel').value='Luis Claudio';
  atualizarDestaqueCampos();
}

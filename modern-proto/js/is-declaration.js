/* PERFECTO · Déclaration fiscale IS, modèle utilisateur « Mod 2011 IS ». */
(function (root, factory) {
  'use strict';
  var zip = root.fflate;
  var ohada = root.PerfectoOhadaFinancialStatements;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    zip = zip || require('../vendor/fflate-0.8.2.js');
    ohada = ohada || require('./ohada-financial-statements.js');
  }
  var api = factory(zip, ohada);
  root.PerfectoIsDeclaration = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis, function (zip, ohada) {
  'use strict';
  var TEMPLATE_URL = 'assets/is-declaration-template.xlsx';
  var TEMPLATE_SHA256 = 'bec9dc0fe66fedb108728a1736c625c7a44ce3ade1664fe2ac95d59f855f1e28';
  var TAX_RATES = { industrial: 25, other: 30, minimum: 1 };
  var POST_MAPPINGS = [
    ['H3','Ventes en l’état de marchandises','income',[]], ['H5','Ventes de produits fabriqués','income',[]],
    ['H7','Production stockée','income',[]], ['H8','Production immobilisée','income',[]],
    ['H9','Travaux et services vendus','income',[]], ['H10','Produits accessoires','income',[]],
    ['H12','Produits financiers','income',[]], ['H16','Achats de marchandises','expense',[]],
    ['H20','Achats de matières premières','expense',[]], ['H24','Achats des autres approvisionnements','expense',[]],
    ['H27','Transports','expense',[]], ['H28','Services extérieurs','expense',[]],
    ['H29','Impôts et taxes','expense',[]], ['H30','Autres charges','expense',[]],
    ['H31','Charges de personnel','expense',[]], ['H32','Dotations aux amortissements et provisions','expense',[]],
    ['H33','Charges financières','expense',[]]
  ].map(function (r) { return { cell:r[0], label:r[1], nature:r[2], posts:r[3] }; });
  var BALANCE_MAPPINGS = [
    ['C7,D7,H7','Immobilisations incorporelles',[],'asset'],
    ['C9,D9,H9','Terrains',[],'asset'], ['C10,D10,H10','Bâtiments',[],'asset'],
    ['C11,D11,H11','Installations et agencements',[],'asset'], ['C12,D12,H12','Matériel',[],'asset'],
    ['C14,D14,H14','Avances sur immobilisations',[],'asset'],
    ['C15,D15,H15','Immobilisations financières',[],'asset'],
    ['C18,D18,H18','Actif circulant HAO',[],'asset'],
    ['C23,D23,H23','Fournisseurs, avances versées',[],'asset'], ['C24,D24,H24','Clients',[],'asset'],
    ['C31,D31,H31','Titres de placement',[],'asset'], ['C32,D32,H32','Valeurs à encaisser',[],'asset'],
    ['S6','Capital',[],'liability'], ['S7','Primes et réserves',[],'liability'],
    ['S8','Report à nouveau',[],'liability'], ['S9','Résultat net',[],'liability'],
    ['S10','Subventions d’investissement',[],'liability'], ['S11','Provisions réglementées',[],'liability'],
    ['S15','Emprunts',[],'liability'], ['S16','Dettes de crédit-bail',[],'liability'],
    ['S19','Provisions financières',[],'liability'], ['S21','Dettes circulantes HAO',[],'liability'],
    ['S22','Clients, avances reçues',[],'liability'], ['S23','Fournisseurs d’exploitation',[],'liability'],
    ['S29','Provisions pour risques à court terme',[],'liability']
  ].map(function (r) { return { cells:r[0].split(','), label:r[1], posts:r[2], kind:r[3] }; });
  var MANUAL_FIELDS = [
    ['IS1!O39','Salariés de l’entreprise'],['IS1!O40','Personnel intérimaire'],['IS1!O41','Immobilisations acquises'],
    ['IS1!O42','Immobilisations acquises par crédit-bail'],['IS1!O43','Immobilisations cédées'],
    ['IS1!O44','Emprunts contractés'],['IS1!O45','Emprunts remboursés'],['IS1!O46','Importations rendues frontière'],
    ['IS1!O47','Exportations'],['IS1!O48','Chiffre d’affaires déclaré en TVA'],['IS1!O49','Frais de personnel déclarés'],
    ['IS1!O50','Véhicules de tourisme'],['IS1!O51','Propriétés immobilières au Bénin'],['IS1!O52','Valeurs locatives'],
    ['IS2!H4','Autres ventes de marchandises'],['IS2!H6','Autres ventes de produits fabriqués'],
    ['IS2!H11','Autres produits AO/HAO'],['IS2!H13','Valeurs locatives'],['IS2!H15','Stock marchandises début'],
    ['IS2!H17','Stock marchandises fin'],['IS2!H19','Stock matières début'],['IS2!H21','Stock matières fin'],
    ['IS2!H23','Stock autres approvisionnements début'],['IS2!H25','Stock autres approvisionnements fin'],
    ['IS2!H35','Résultat sur cession d’actifs'],['IS2!H38','Charges non déductibles'],['IS2!H39','Déductions autorisées'],
    ['IS2!H42','Déficits antérieurs reportables'],['IS2!H43','Rappel d’impôts antérieurs'],['IS2!H44','Résultat taxable final à confirmer'],
    ['IS3!C6','Charges immobilisées brut'],['IS3!D6','Charges immobilisées amortissements/provisions'],
    ['IS3!C13','Matériel de transport brut'],['IS3!D13','Matériel de transport amortissements/provisions'],
    ['IS3!C19','Marchandises brut'],['IS3!D19','Marchandises amortissements/provisions'],
    ['IS3!C20','Matières premières brut'],['IS3!D20','Matières premières amortissements/provisions'],
    ['IS3!C21','Produits fabriqués brut'],['IS3!D21','Produits fabriqués amortissements/provisions'],
    ['IS3!C22','Autres actifs circulants brut'],['IS3!D22','Autres actifs circulants amortissements/provisions'],
    ['IS3!C25','Personnel créances brutes'],['IS3!C26','État créances brutes'],['IS3!C27','Associés créances brutes'],
    ['IS3!C28','Régularisations actif brut'],['IS3!C29','Autres créances brutes'],
    ['IS3!D25','Personnel provisions'],['IS3!D26','État provisions'],['IS3!D27','Associés provisions'],
    ['IS3!D28','Régularisations actif provisions'],['IS3!D29','Autres créances provisions'],
    ['IS3!C33','Banques brut'],['IS3!D33','Banques provisions'],['IS3!C34','Caisse brut'],['IS3!D34','Caisse provisions'],
    ['IS3!C35','Divers actif brut'],['IS3!D35','Divers actif provisions'],['IS3!S18','Autres dettes financières'],
    ['IS3!S24','Dettes fiscales'],['IS3!S25','Dettes sociales'],['IS3!S26','Associés et groupe'],
    ['IS3!S27','Régularisations passif'],['IS3!S28','Autres dettes'],['IS3!S31','Banques trésorerie passif'],
    ['IS3!S32','Divers trésorerie passif'],['IS4!O3','Impôt minimum selon le modèle, montant à vérifier'],['IS4!O4','Impôt société industrielle, montant à vérifier'],['IS4!O5','Impôt autres sociétés, montant à vérifier'],
    ['IS4!O8','Acompte réel normal 1'],['IS4!O9','Acompte réel normal 2'],
    ['IS4!D11','Acompte réel simplifié 1'],['IS4!J11','Acompte réel simplifié 2'],
    ['IS4!O12','Autres imputations documentées'],['IS4!O13','Seconde imputation à confirmer']
  ].map(function (r) { return { key:r[0], label:r[1] }; }).concat(POST_MAPPINGS.map(function (r) {
    return { key:'IS2!'+r.cell, label:r.label+' — remplacement manuel si nécessaire' };
  })).concat(BALANCE_MAPPINGS.reduce(function (a,r) {
    r.cells.forEach(function (cell) { a.push({ key:'IS3!'+cell, label:r.label+' — saisie manuelle ('+cell+')' }); }); return a;
  },[]));
  function cleanPosts(v) { var seen={}; return (Array.isArray(v)?v:String(v||'').split(/[\s,;]+/)).map(function(x){return String(x||'').trim().toUpperCase();}).filter(function(x){if(!/^[A-Z]{1,3}$/.test(x)||seen[x])return false;seen[x]=1;return true;}); }
  function defaults() { var m={}; POST_MAPPINGS.forEach(function(r){m[r.cell]=r.posts.slice();}); BALANCE_MAPPINGS.forEach(function(r){m['IS3!'+r.cells.join(',')]=r.posts.slice();}); return {mappings:m}; }
  function normalise(c) { var d=defaults(); Object.keys(d.mappings).forEach(function(k){if(c&&c.mappings&&Object.prototype.hasOwnProperty.call(c.mappings,k))d.mappings[k]=cleanPosts(c.mappings[k]);}); return d; }
  function rowsById(rows) { var out={}; (rows||[]).forEach(function(r){if(r&&r.id)out[r.id]=String(r.value||'').trim();}); return out; }
  function number(v,signed) { if(v==null||String(v).trim()==='')return null; var n=Number(String(v).replace(/\s/g,'').replace(',','.')); return Number.isFinite(n)&&(signed||n>=0)?n:null; }
  function calculate(o) {
    o=o||{}; var cfg=normalise(o.configuration), m=o.manual||{}, result=ohada.computeStatementData({balance:o.balance||[],mappings:o.accountMappings||{}});
    var p=result.postTotals||{}, values={}, caches={}, gaps=(result.gaps||[]).map(function(g){return {sheet:'OHADA',cell:g.cell||'',field:g.field||'Compte',message:g.reason||'Rattachement à vérifier.',action:g.action||'Vérifier le cadre comptable.'};});
    function addGap(sheet,cell,field,message){gaps.push({sheet:sheet,cell:cell,field:field,message:message,action:'Vérifier la source ou saisir une valeur justifiée.'});}
    function set(k,v){values[k]=v==null?null:Number(v);}
    function manual(k,signed){if(!Object.prototype.hasOwnProperty.call(m,k)||m[k]==null||String(m[k]).trim()==='')return null;var v=number(m[k],!!signed||k==='IS2!H7');if(v==null)addGap(k.split('!')[0],k.split('!')[1],k,'Montant manuel invalide; cellule laissée vide.');return v;}
    function total(codes,nature){codes=cleanPosts(codes);if(!codes.length)return null;var a=codes.map(function(c){return p[c];});if(a.some(function(x){return !x;}))return null;return a.reduce(function(s,x){return s+(nature==='income'?x.credit-x.debit:x.debit-x.credit);},0);}
    POST_MAPPINGS.forEach(function(r){var ov=manual('IS2!'+r.cell,false),v=ov==null?total(cfg.mappings[r.cell],r.nature):ov;set('IS2!'+r.cell,v);if(v==null)addGap('IS2',r.cell,r.label,'Poste(s) OHADA absent(s) ou non configuré(s); montant laissé vide.');});
    MANUAL_FIELDS.forEach(function(f){if(f.key.indexOf('IS2!')!==0||f.key==='IS2!H35')return;var v=manual(f.key,false);if(v!=null)set(f.key,v);else if(!(f.key in values))set(f.key,null);});
    function get(k){return Object.prototype.hasOwnProperty.call(values,k)?values[k]:null;}
    var dis=manual('IS2!H35',true); set('IS2!H35',dis);if(dis==null)addGap('IS2','H35','Cessions','Produit de cession et valeur comptable à rapprocher.');
    var products=['H3','H4','H5','H6','H7','H8','H9','H10','H11','H12','H13'];
    function sumCells(cells){return cells.every(function(c){return get('IS2!'+c)!=null;})?cells.reduce(function(s,c){return s+get('IS2!'+c);},0):null;}
    var prod=sumCells(products), merch=['H15','H16','H17'].every(function(c){return get('IS2!'+c)!=null;})?get('IS2!H15')+get('IS2!H16')-get('IS2!H17'):null;
    var raw=['H19','H20','H21'].every(function(c){return get('IS2!'+c)!=null;})?get('IS2!H19')+get('IS2!H20')-get('IS2!H21'):null;
    var other=['H23','H24','H25'].every(function(c){return get('IS2!'+c)!=null;})?get('IS2!H23')+get('IS2!H24')-get('IS2!H25'):null;
    var expenses=sumCells(['H27','H28','H29','H30','H31','H32','H33']);
    set('IS2!H14',prod);set('IS2!H18',merch);set('IS2!H22',raw);set('IS2!H26',other);set('IS2!H34',expenses);caches['IS2!H14']=prod;caches['IS2!H34']=expenses;
    var before=prod==null||merch==null||raw==null||other==null||expenses==null||dis==null?null:prod-merch-raw-other-expenses+dis;
    set('IS2!H36',before==null?null:Math.max(before,0));set('IS2!H37',before==null?null:Math.max(-before,0));if(before==null)addGap('IS2','H36:H37','Résultat avant impôt','Plusieurs lignes de produits, stocks, charges ou cessions restent inconnues.');
    var addbacks=get('IS2!H38'),deductions=get('IS2!H39'),fiscal=before==null||addbacks==null||deductions==null?null:before+addbacks-deductions;
    set('IS2!H40',fiscal==null?null:Math.max(fiscal,0));set('IS2!H41',fiscal==null?null:Math.max(-fiscal,0));
    var taxable=manual('IS2!H44',false);set('IS2!H44',taxable);if(taxable==null)addGap('IS2','H44','Résultat taxable','Résultat final à saisir après validation du traitement fiscal des déficits et rappels d’impôts.');
    BALANCE_MAPPINGS.forEach(function(r){var selected=cleanPosts(cfg.mappings['IS3!'+r.cells.join(',')]);var entries=selected.map(function(c){return p[c];});var vals=null;
      if(r.kind==='asset'&&entries.length&&entries.every(Boolean)){var gross=entries.reduce(function(s,x){return s+(x.normalDebit||0)-(x.normalCredit||0);},0);var dep=entries.reduce(function(s,x){return s+(x.depreciationCredit||0)-(x.depreciationDebit||0);},0);vals=[gross,dep,gross-dep];}
      if(r.kind==='liability'&&entries.length&&entries.every(Boolean))vals=[entries.reduce(function(s,x){return s+x.credit-x.debit;},0)];
      r.cells.forEach(function(c,i){set('IS3!'+c,vals?vals[i]:null);});if(!vals&&!r.cells.every(function(c){return number(m['IS3!'+c],false)!=null;}))addGap('IS3',r.cells.join(','),r.label,'Postes OHADA incomplets; ligne laissée vide.');
    });
    MANUAL_FIELDS.forEach(function(f){if(f.key.indexOf('IS3!')!==0)return;var v=manual(f.key,false);if(v!=null)set(f.key,v);else if(!(f.key in values))set(f.key,null);});
    [6,13,19,20,21,22,25,26,27,28,29,33,34,35].forEach(function(r){var k='IS3!H'+r;if(get(k)==null){var a=get('IS3!C'+r),b=get('IS3!D'+r);set(k,a==null||b==null?null:a-b);}});
    var info=rowsById(o.printedInformationRows),start=o.cycleStart||'',end=o.cycleEnd||'',year=String(end).slice(0,4),months=fullMonths(start,end);
    if(!info['company-name'])addGap('IS1','','Raison sociale','Raison sociale absente des informations du dossier.');if(!info['ifu-number'])addGap('IS1','','IFU','Numéro IFU absent des informations du dossier.');if(!info['head-office-address'])addGap('IS1','','Adresse siège','Adresse siège absente.');
    if(!months)addGap('IS1','','Durée de l’exercice','Durée en mois non déduite car la période n’est pas constituée de mois civils complets.');
    MANUAL_FIELDS.forEach(function(f){if(f.key.indexOf('IS1!')!==0)return;var v=manual(f.key,false);if(v!=null)set(f.key,v);else if(!(f.key in values))set(f.key,null);});
    ['O44','O45','O46','O47','O48','O49'].forEach(function(c){caches['IS1!'+c]=get('IS1!'+c);});
    caches['IS1!D12']=year?Number(year):null;caches['IS1!K12']='';caches['IS1!D15']=info['ifu-number']||'';caches['IS1!D16']=info['company-name']||'';
    var assetRows=[6,7,9,10,11,12,13,14,15,18,19,20,21,22,23,24,25,26,27,28,29,31,32,33,34,35];
    var passRows=[6,7,8,9,10,11,15,16,18,19,21,22,23,24,25,26,27,28,29,31,32];
    function formulaSum(sheet,cell,refs){caches[sheet+'!'+cell]=refs.every(function(r){return get(sheet+'!'+r)!=null;})?refs.reduce(function(s,r){return s+get(sheet+'!'+r);},0):null;}
    formulaSum('IS3','C36',assetRows.map(function(r){return 'C'+r;}));formulaSum('IS3','D36',assetRows.filter(function(r){return r<=34;}).map(function(r){return 'D'+r;}));formulaSum('IS3','S36',passRows.map(function(r){return 'S'+r;}));caches['IS3!H36']=caches['IS3!C36']==null||caches['IS3!D36']==null?null:caches['IS3!C36']-caches['IS3!D36'];
    var type=o.companyType==='industrial'||o.companyType==='other'?o.companyType:'';var regime=o.regime==='normal'||o.regime==='simplified'?o.regime:'';
    if(!type)addGap('IS4','O4:O5','Type de société','Type industriel ou autres sociétés à confirmer.');if(!regime)addGap('IS1','C10:C11','Régime fiscal','Régime réel normal ou simplifié à confirmer.');
    var minTax=manual('IS4!O3',false), industrialTax=manual('IS4!O4',false), otherTax=manual('IS4!O5',false);
    var selectedTax=type==='industrial'?industrialTax:(type==='other'?otherTax:null);var tax=type&&selectedTax!=null?(industrialTax||0)+(otherTax||0):null;
    set('IS4!O2',get('IS2!H44'));set('IS4!O3',minTax);set('IS4!O4',industrialTax);set('IS4!O5',otherTax);
    if(minTax==null)addGap('IS4','O3','Impôt minimum','Montant à déterminer et valider par le déclarant selon les règles applicables.');
    if(type==='industrial'&&industrialTax==null)addGap('IS4','O4','Impôt société industrielle','Montant à calculer et valider; le taux imprimé dans le modèle n’est pas une validation du taux applicable.');
    if(type==='other'&&otherTax==null)addGap('IS4','O5','Impôt autres sociétés','Montant à calculer et valider; le taux imprimé dans le modèle n’est pas une validation du taux applicable.');
    var pay1=regime==='normal'?manual('IS4!O8',false):0,pay2=regime==='normal'?manual('IS4!O9',false):0,s1=regime==='simplified'?manual('IS4!D11',false):0,s2=regime==='simplified'?manual('IS4!J11',false):0,cr1=manual('IS4!O12',false),cr2=manual('IS4!O13',false);
    if(regime==='normal'&&(pay1==null||pay2==null))addGap('IS4','O8:O9','Acomptes','Acomptes du régime réel normal à renseigner.');if(regime==='simplified'&&(s1==null||s2==null))addGap('IS4','D11,J11','Acomptes','Acomptes du régime simplifié à renseigner.');if(cr1==null||cr2==null)addGap('IS4','O12:O13','Imputations','AIB/retenues ou crédits à confirmer.');
    set('IS4!O8',pay1);set('IS4!O9',pay2);set('IS4!D11',s1);set('IS4!J11',s2);set('IS4!O11',regime==='simplified'&&s1!=null&&s2!=null?s1+s2:(regime==='normal'?0:null));set('IS4!O12',cr1);set('IS4!O13',cr2);
    var due=tax==null||pay1==null||pay2==null||get('IS4!O11')==null||cr1==null||cr2==null?null:tax-pay1-pay2-get('IS4!O11')-cr1-cr2;set('IS4!O14',due);set('IS4!C41',due);set('IS4!O15',tax==null?null:tax/4);set('IS4!O16',tax==null?null:tax/2);
    caches['IS4!O11']=get('IS4!O11');caches['IS4!O14']=due;caches['IS4!C41']=due;caches['IS4!O15']=get('IS4!O15');caches['IS4!O16']=get('IS4!O16');if(due==null)addGap('IS4','O14','Solde à payer','Impôt ou imputation inconnus; solde non calculé.');if(due!=null&&due<0)addGap('IS4','O14','Solde à payer','Imputations supérieures à l’impôt; crédit à valider.');
    MANUAL_FIELDS.forEach(function(f){var k=f.key.split('!')[1];if(get(f.key)==null&&!gaps.some(function(g){return g.sheet===f.key.split('!')[0]&&g.cell===k;}))addGap(f.key.split('!')[0],k,f.label,'Donnée source non fournie; cellule laissée vide.');});
    var names={anExer:year?Number(year):null,perExer:'',numFisc:info['ifu-number']||'',soNom:info['company-name']||'',_nSo:info['company-name']||'',_soNom:info['company-name']||'',_sigle:info['business-name']||'',_soSigle:info['business-name']||'',_insae:info['insae-number']||'',_soId:info['ifu-number']||'',_soNumFisc:info['ifu-number']||'',_soAdr:info['head-office-address']||'',_soAg1:info['secondary-address-1']||'',_soAg2:info['secondary-address-2']||'',_regCom:info['trade-register-number']||'',_Ville:info['tax-office-city']?'CENTRE DES IMPÔTS DE '+info['tax-office-city']:'',_centreImpot:'CENTRE DES IMPOTS DE ', _dAn:year?' '+year:'',_dDeb:start?' '+dateFr(start):'',_dFin:end?' '+dateFr(end):'',_ExerClos:end?'Exercice clos le '+dateFr(end):'',_ExerFin:end?' '+dateFr(end):'',_ExerFin1:'',_Duree:months?'Durée (en mois) '+months:'',_Mois:months||null,_nbMois:months||null,_sTabExer:end?'Tableau financiers au '+dateFr(end):'',_Pays:'REPUBLIQUE DU BENIN',_nCompletPays:'REPUBLIQUE DU BENIN',emprExer:get('IS1!O44'),emprRemb:get('IS1!O45'),imAcq:get('IS1!O41'),imVen:get('IS1!O43'),mImport:get('IS1!O46'),mExport:get('IS1!O47'),mVenLoc:get('IS1!O48'),mSal:get('IS1!O49'),tauxImpot:null};
    return {values:values,formulaCaches:caches,names:names,gaps:gaps,postTotals:p,complete:gaps.length===0,totals:{products:prod,expenses:expenses,beforeTax:before,taxableResult:get('IS2!H44'),minimumBase:null,minimumTax:minTax,tax:tax,due:due},balanceSummary:result.summary};
  }
  function fullMonths(a,b){var x=/^(\d{4})-(\d{2})-(\d{2})$/.exec(a),y=/^(\d{4})-(\d{2})-(\d{2})$/.exec(b);if(!x||!y||Number(x[2])<1||Number(x[2])>12||Number(y[2])<1||Number(y[2])>12)return null;var last=new Date(Date.UTC(+y[1],+y[2],0)).getUTCDate();if(+x[3]!==1||+y[3]!==last)return null;var n=(+y[1]-+x[1])*12+(+y[2]-+x[2])+1;return n>0?n:null;}
  function dateFr(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));return m?m[3]+'/'+m[2]+'/'+m[1]:'';}
  function attr(tag,name){var re=new RegExp('(?:^|\\s)'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'="([^"]*)"');var m=re.exec(tag);return m?m[1]:'';}
  function dec(b){return new TextDecoder().decode(b);}function enc(s){return new TextEncoder().encode(s);}
  function sheetPaths(files){var w=dec(files['xl/workbook.xml']),r=dec(files['xl/_rels/workbook.xml.rels']),targets={};r.replace(/<Relationship\b[^>]*\/?\s*>/g,function(t){targets[attr(t,'Id')]='xl/'+attr(t,'Target').replace(/^\.\//,'');});var sheets={};w.replace(/<sheet\b[^>]*\/?\s*>/g,function(t){sheets[attr(t,'name')]=targets[attr(t,'r:id')||attr(t,'id')];});return {xml:w,sheets:sheets};}
  function cellRe(ref){return new RegExp('<c\\b(?=[^>]*\\br="'+ref+'")[^>]*?(?:/\\s*>|>[\\s\\S]*?<\\/c>)');}
  function clearCell(xml,ref){return xml.replace(cellRe(ref),function(c){if(/<f(?:\s|>)/.test(c))return c.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>|<v\s*\/>/g,'');var o=/^<c\b[^>]*>/.exec(c);return o?o[0].replace(/\s+t="[^"]*"/g,'>')+'</c>':c;});}
  function writeCell(xml,ref,value){if(value==null||!Number.isFinite(Number(value)))return clearCell(xml,ref);var found=false;var out=xml.replace(cellRe(ref),function(c){found=true;if(/<f(?:\s|>)/.test(c))return c;var o=/^<c\b[^>]*>/.exec(c);if(!o)return c;return o[0].replace(/\s+t="[^"]*"/g,'>')+'<v>'+Number(value)+'</v></c>';});if(!found)throw Error('Cellule modèle absente : '+ref);return out;}
  function cacheCell(xml,ref,value){var found=false;var out=xml.replace(cellRe(ref),function(c){found=true;if(!/<f(?:\s|>)/.test(c))throw Error('Formule modèle absente : '+ref);if(value==null||value==='')return c.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>|<v\s*\/>/g,'').replace(/\s+t="[^"]*"/g,'');var text=typeof value==='string';var o=/^<c\b[^>]*>/.exec(c)[0].replace(/\s+t="[^"]*"/g,'');if(text)o=o.replace(/>$/,' t="str">');var body=c.slice(/^<c\b[^>]*>/.exec(c)[0].length);var v=text?String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):String(Number(value));body=/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/.test(body)?body.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/,'<v>'+v+'</v>'):body.replace(/<\/f>/,'</f><v>'+v+'</v>');return o+body;});if(!found)throw Error('Formule modèle absente : '+ref);return out;}
  function setName(xml,name,value){var esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),re=new RegExp('(<definedName\\b(?=[^>]*\\bname="'+esc+'")[^>]*>)([\\s\\S]*?)(<\\/definedName>)'),text=value==null||value===''?'""':typeof value==='number'?String(value):'"'+String(value).replace(/"/g,'""')+'"',found=false;text=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');var out=xml.replace(re,function(_a,o,_v,c){found=true;return o+text+c;});if(!found)throw Error('Nom défini absent : '+name);return out;}
  function generateWorkbook(bytes,prepared){prepared=prepared&&prepared.calculated?prepared.calculated:prepared;if(!prepared||!prepared.values)throw Error('Préparation IS invalide.');var files=zip.unzipSync(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes));var refs=sheetPaths(files),s=refs.sheets;['IS1','IS2','IS3','IS4'].forEach(function(n){if(!s[n])throw Error('Feuille du modèle absente : '+n);});var paths=Object.keys(s),count=paths.reduce(function(n,k){return n+(dec(files[s[k]]).match(/<f(?:\s[^>]*)?>/g)||[]).length;},0);if(count!==21)throw Error('Le modèle doit conserver ses 21 formules.');
    for(var r=3;r<=44;r++)files[s.IS2]=enc(clearCell(dec(files[s.IS2]),'H'+r));['C','D','H','S'].forEach(function(c){for(var i=6;i<=49;i++)files[s.IS3]=enc(clearCell(dec(files[s.IS3]),c+i));});['O2','O3','O4','O5','O8','O9','O11','O12','O13','O14','O15','O16','D11','J11','C41'].forEach(function(c){files[s.IS4]=enc(clearCell(dec(files[s.IS4]),c));});for(var j=39;j<=55;j++)files[s.IS1]=enc(clearCell(dec(files[s.IS1]),'O'+j));['D12','K12','D15','D16'].forEach(function(c){files[s.IS1]=enc(clearCell(dec(files[s.IS1]),c));});
    Object.keys(prepared.values).forEach(function(k){var a=k.split('!');if(!s[a[0]])throw Error('Feuille inconnue : '+a[0]);files[s[a[0]]]=enc(writeCell(dec(files[s[a[0]]]),a[1],prepared.values[k]));});
    Object.keys(prepared.formulaCaches).forEach(function(k){var a=k.split('!');files[s[a[0]]]=enc(cacheCell(dec(files[s[a[0]]]),a[1],prepared.formulaCaches[k]));});
    var w=dec(files['xl/workbook.xml']),dn=[];w.replace(/<definedName\b[^>]*\bname="([^"]+)"[^>]*>/g,function(_m,n){dn.push(n);});dn.forEach(function(n){w=setName(w,n,'');});Object.keys(prepared.names).forEach(function(n){w=setName(w,n,prepared.names[n]);});w=w.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcMode="manual" fullCalcOnLoad="0" forceFullCalc="0"/>');files['xl/workbook.xml']=enc(w);var after=paths.reduce(function(n,k){return n+(dec(files[s[k]]).match(/<f(?:\s[^>]*)?>/g)||[]).length;},0);if(after!==count)throw Error('Les formules du modèle ont changé.');return {bytes:zip.zipSync(files,{level:6}),complete:prepared.complete,gaps:prepared.gaps,formulaCount:after};}
  function csv(prepared){var rows=[['Feuille','Cellule','Rubrique','Point à vérifier','Action']];(prepared.calculated||prepared).gaps.forEach(function(g){rows.push([g.sheet,g.cell,g.field,g.message,g.action]);});return '\ufeff'+rows.map(function(r){return r.map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');}
  async function loadTemplate(){var r=await fetch(TEMPLATE_URL,{cache:'no-store'});if(!r.ok)throw Error('Le modèle IS local est inaccessible.');var b=new Uint8Array(await r.arrayBuffer());if(globalThis.crypto&&crypto.subtle){var d=await crypto.subtle.digest('SHA-256',b),h=Array.from(new Uint8Array(d)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');if(h!==TEMPLATE_SHA256)throw Error('Le modèle IS intégré a été modifié.');}return b;}
  return {TEMPLATE_URL:TEMPLATE_URL,TEMPLATE_SHA256:TEMPLATE_SHA256,TAX_RATES:TAX_RATES,POST_MAPPINGS:POST_MAPPINGS,BALANCE_MAPPINGS:BALANCE_MAPPINGS,MANUAL_FIELDS:MANUAL_FIELDS,defaults:defaults,normalise:normalise,calculate:calculate,generateWorkbook:generateWorkbook,buildGapCsv:csv,loadTemplate:loadTemplate};
}));

/* PERFECTO · Proposition de déclaration IBA fondée sur l’extrait du Code des impôts fourni. */
(function (root, factory) {
  'use strict';
  var ohada = root.PerfectoOhadaFinancialStatements;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') ohada = ohada || require('./ohada-financial-statements.js');
  var api = factory(ohada);
  root.PerfectoIbaDeclaration = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis, function (ohada) {
  'use strict';
  var LAW_VERSION = 'Extrait du Code des impôts fourni par l’utilisateur — articles 54 à 67';
  var RATES = { standard: 30, privateEducation: 25, minimumStandard: 1.5, buildingAndPublicWorks: 3, realEstateDominant: 10, serviceStationPerLitre: 0.60, minimumCfa: 250000, familyInsuranceCap: 5, mixedExpenseDeductibleShare: 30, ortbLevy: 4000 };
  var PROFILES = [
    { id: 'standard', label: 'Autre activité imposable', rate: RATES.standard, minimumRate: RATES.minimumStandard, article: '63.1 et 64.1' },
    { id: 'privateEducation', label: 'Établissement privé d’enseignement', rate: RATES.privateEducation, minimumRate: RATES.minimumStandard, article: '63.2 et 64.1' },
    { id: 'buildingAndPublicWorks', label: 'Bâtiment et travaux publics', rate: RATES.standard, minimumRate: RATES.buildingAndPublicWorks, article: '63.1 et 64.2.a' },
    { id: 'realEstateDominant', label: 'Entreprise à prépondérance immobilière', rate: RATES.standard, minimumRate: RATES.realEstateDominant, article: '63.1 et 64.2.b' },
    { id: 'usedVehicles', label: 'Commerce de véhicules d’occasion', rate: RATES.standard, minimumRate: null, article: '64.2.c — minimum réglementaire à confirmer' },
    { id: 'consumerGoods', label: 'Certains produits de grande consommation', rate: RATES.standard, minimumRate: null, article: '64.2.c — minimum réglementaire à confirmer' },
    { id: 'serviceStation', label: 'Station-service / distributeur assimilé', rate: RATES.standard, minimumRate: null, article: '64.3.b' }
  ];
  var EXEMPTIONS = [
    { id: 'none', label: 'Aucune exonération identifiée' },
    { id: 'agriculture', label: 'Exploitation agricole, élevage ou pêche — art. 58.1' },
    { id: 'visualArtist', label: 'Artiste ne vendant que le produit de son art — art. 58.2' },
    { id: 'performingArtist', label: 'Musicien, comédien ou autre artiste pour sa prestation — art. 58.3' },
    { id: 'ventureCapital', label: 'Fonds en gestion auprès d’une entreprise de capital-risque depuis au moins trois ans — art. 58.4' },
    { id: 'gambling', label: 'Gains de jeux de hasard — art. 58.5' },
    { id: 'professionalTax', label: 'Contribuable relevant de la taxe professionnelle synthétique — art. 58.6' }
  ];
  var FIELDS = [
    ['accountingResultBenin', 'Résultat comptable attribuable au Bénin (FCFA)', 'Article 59 · résultat de l’exercice après comptabilité, hors part non imposable au Bénin'],
    ['personalDrawings', 'Prélèvements personnels non déductibles déjà compris dans les charges (FCFA)', 'Article 61.1'],
    ['personalExpenses', 'Dépenses d’intérêt personnel de l’exploitant déjà déduites (FCFA)', 'Article 61.2'],
    ['ownerCapitalInterest', 'Intérêts/rémunérations des capitaux propres déjà déduits (FCFA)', 'Article 61.3'],
    ['nonLinearDepreciation', 'Amortissements non linéaires déjà déduits (FCFA)', 'Article 60.2.a · part à réintégrer; aucun taux ou durée n’est présumé'],
    ['mixedExpenses', 'Dépenses mixtes comptabilisées sans ventilation justifiée (FCFA)', 'Article 60.4 · seule la part professionnelle de 30 % est retenue selon l’extrait'],
    ['nonProfessionalPropertyIncome', 'Produits d’immeubles inscrits à l’actif sans utilité professionnelle (FCFA)', 'Article 60.5 · part à retrancher du bénéfice professionnel'],
    ['nonProfessionalPropertyExpenses', 'Charges immobilières non professionnelles déjà déduites (FCFA)', 'Article 60.5 · part à réintégrer; documenter la quote-part'],
    ['spouseSalaryDisallowed', 'Salaire du conjoint non déductible faute de conditions réunies (FCFA)', 'Article 60.3 · participation effective, montant normal, cotisations sociales et retenues'],
    ['familySalaryDisallowed', 'Rémunérations familiales non déductibles faute de conditions réunies (FCFA)', 'Article 60.3 · versement réel, travail effectif et conditions normales'],
    ['otherAdditions', 'Autres réintégrations fiscales justifiées (FCFA)', 'Articles 60 et 61 · détailler les fondements dans la référence justificative'],
    ['otherDeductions', 'Autres déductions fiscales justifiées (FCFA)', 'Articles 60 et 61 · détailler les fondements dans la référence justificative'],
    ['gainDeferredArticle62', 'Plus-value de fonds de commerce dont l’imposition est reportée (FCFA)', 'Article 62 · seulement si la continuation et les évaluations d’actif respectent les conditions'],
    ['pensionAndLifePaid', 'Versements volontaires retraite et primes d’assurance-vie payés (FCFA)', 'Article 60.3 · limite globale de 5 % du bénéfice avant leur déduction'],
    ['pensionAndLifeAlreadyDeducted', 'Part de ces versements déjà déduite du résultat comptable (FCFA)', 'Nécessaire pour éviter de déduire deux fois la même dépense'],
    ['lossYear1', 'Déficit documenté de N−1, non déjà imputé (FCFA)', 'Article 60.2.b · report dans la limite de trois ans'],
    ['lossYear2', 'Déficit documenté de N−2, non déjà imputé (FCFA)', 'Article 60.2.b · report dans la limite de trois ans'],
    ['lossYear3', 'Déficit documenté de N−3, non déjà imputé (FCFA)', 'Article 60.2.b · report dans la limite de trois ans'],
    ['confirmedTaxableBase', 'Base imposable vérifiée et confirmée (FCFA)', 'Base d’impôt à confirmer après contrôle des règles IS auxquelles renvoie l’article 60.1'],
    ['cashableProducts', 'Produits encaissables établis conformément à l’article 47 (FCFA)', 'Article 64.1 · la définition de l’article 47 doit être vérifiée'],
    ['specialMinimum', 'Minimum réglementaire confirmé, si véhicules/produits concernés (FCFA)', 'Article 64.2.c · montant et modalités non fournis dans l’extrait'],
    ['stationLitres', 'Volume de produits pétroliers vendus (litres)', 'Article 64.3.b · appliquer 0,60 FCFA par litre'],
    ['profitSharePercent', 'Quote-part de bénéfice attribuée au contribuable (%)', 'Article 57 · requis pour associé ou indivisaire'],
    ['taxpayerName', 'Nom et prénoms du contribuable', 'Identité de la personne physique — à vérifier'],
    ['taxpayerIfu', 'Numéro IFU', 'Identifiant fiscal — à vérifier'],
    ['taxpayerAddress', 'Adresse du contribuable', 'Identité fiscale — à vérifier'],
    ['businessDescription', 'Activité effectivement exercée', 'Articles 54 à 56 — description par le déclarant'],
    ['taxOffice', 'Centre des impôts destinataire', 'Destinataire — à confirmer'],
    ['supportingReference', 'Références des pièces et justificatifs', 'Piste d’audit — joindre les pièces requises']
  ];
  var AMOUNT_FIELDS = FIELDS.filter(function (f) { return ['accountingResultBenin','personalDrawings','personalExpenses','ownerCapitalInterest','nonLinearDepreciation','mixedExpenses','nonProfessionalPropertyIncome','nonProfessionalPropertyExpenses','spouseSalaryDisallowed','familySalaryDisallowed','otherAdditions','otherDeductions','gainDeferredArticle62','pensionAndLifePaid','pensionAndLifeAlreadyDeducted','lossYear1','lossYear2','lossYear3','confirmedTaxableBase','cashableProducts','specialMinimum','stationLitres','profitSharePercent'].indexOf(f[0]) !== -1; });
  function amount(v) {
    if (v == null || String(v).trim() === '') return null;
    var n = Number(String(v).trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function truth(v) { return v === true || v === 'yes'; }
  function recordGap(gaps, field, message, article) { gaps.push({ field: field, message: message, article: article || '', status: 'À vérifier' }); }
  function profile(id) { return PROFILES.find(function (x) { return x.id === id; }) || null; }
  function calculate(input) {
    input = input || {};
    var data = input.data || input;
    var gaps = [], warnings = [], amounts = Object.create(null), values = Object.create(null);
    var exempt = data.exemption && data.exemption !== 'none';
    if (exempt) {
      var exemption = EXEMPTIONS.find(function (x) { return x.id === data.exemption; });
      var exemptionWarning = { message: 'IBA non calculé : exonération/exclusion déclarée par l’utilisateur — ' + (exemption ? exemption.label : data.exemption) + '. Vérifier les conditions et conserver les justificatifs.', article: 'Article 58' };
      return { lawVersion: LAW_VERSION, complete: false, status: 'exemption-declared', profile: null, values: {}, amounts: {}, gaps: [], warnings: [exemptionWarning], totals: {}, declaration: { name: String(data.taxpayerName || ''), ifu: String(data.taxpayerIfu || ''), address: String(data.taxpayerAddress || ''), activity: String(data.businessDescription || ''), taxOffice: String(data.taxOffice || ''), periodStart: String(input.cycleStart || ''), periodEnd: String(input.cycleEnd || ''), taxpayerKind: String(data.taxpayerKind || ''), activityCategory: String(data.activityCategory || ''), exemption: String(data.exemption || ''), accountingMethod: String(data.accountingMethod || ''), supportingReference: String(data.supportingReference || '') } };
    }
    var requiredIdentity = ['taxpayerName','taxpayerIfu','taxpayerAddress','businessDescription','taxOffice'];
    requiredIdentity.forEach(function (key) { if (!String(data[key] || '').trim()) recordGap(gaps, key, 'Information déclarative absente.', ''); });
    ['taxpayerKind','activityCategory','exemption','territoryVerified','accountingMethod','profile','halfReduction','combinedBusinessAndLiberal','successionArticle62Verified'].forEach(function (key) {
      if (!String(data[key] == null ? '' : data[key]).trim()) recordGap(gaps, key, 'Classification requise; aucune valeur par défaut n’est appliquée.', key === 'exemption' ? 'Article 58' : 'Articles 54 à 67');
    });
    if (data.taxpayerKind === 'individual') ['ownAccount','habitualActivity'].forEach(function (key) { if (!String(data[key] || '').trim()) recordGap(gaps,key,'Confirmer la condition de l’article 54.','Article 54'); });
    var liableKind = ['individual','partnerNotIs','indivision'].indexOf(data.taxpayerKind) !== -1;
    if (data.taxpayerKind && !liableKind) recordGap(gaps,'taxpayerKind','Ce profil ne relève pas de l’imposition personnelle IBA décrite aux articles 54 et 57.','Articles 54 et 57');
    if (data.taxpayerKind === 'individual' && (!truth(data.ownAccount) || !truth(data.habitualActivity))) recordGap(gaps, 'taxpayerKind', 'L’assujettissement de l’article 54 vise une personne physique exerçant habituellement pour son propre compte une activité lucrative.', 'Article 54');
    if ((data.taxpayerKind === 'partnerNotIs' || data.taxpayerKind === 'indivision') && !truth(data.transparentEntityVerified)) recordGap(gaps, 'transparentEntityVerified', 'Confirmer que la société n’est pas soumise à l’IS et documenter les droits/parts.', 'Article 57');
    if (!['business','liberal','nonCommercial','intellectualProperty','equippedLease','propertyIntermediary','propertyResale','landSubdivision','agriculture','artist','performingArtist','other'].includes(data.activityCategory)) recordGap(gaps, 'activityCategory', 'Nature de l’activité imposable à qualifier.', 'Articles 55 et 56');
    if (data.accountingMethod === 'cash') {
      var eligibleCashActivity = ['liberal','nonCommercial','intellectualProperty'].indexOf(data.activityCategory) !== -1;
      if (!eligibleCashActivity) recordGap(gaps, 'accountingMethod', 'L’option de caisse décrite par l’article 67.2 est réservée aux professions libérales, activités non commerciales et revenus de propriété intellectuelle/industrielle.', 'Article 67.2');
      if (!truth(data.cashOptionVerified)) recordGap(gaps, 'cashOptionVerified', 'Prouver l’option exercée avant le 30 novembre de l’année précédente et son entrée en vigueur au 1er janvier.', 'Article 67.2');
      var optionDate = String(data.cashOptionDate || ''), year = Number(String(input.cycleStart || '').slice(0, 4));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(optionDate) || !year || optionDate >= String(year - 1) + '-11-30' || String(input.cycleStart || '').slice(5) !== '01-01') recordGap(gaps, 'cashOptionDate', 'Date d’option ou début d’exercice incompatible avec la règle décrite; vérifier la pièce d’option.', 'Article 67.2');
    }
    if (data.combinedBusinessAndLiberal === 'yes' && data.accountingMethod !== 'accrual') recordGap(gaps,'accountingMethod','Lorsque bénéfices industriels/commerciaux et revenus non commerciaux sont réalisés simultanément, déterminer les résultats selon les règles de l’article 67.1 (engagement).','Article 67.3');
    if (data.combinedBusinessAndLiberal === 'yes') warnings.push({ message: 'Activités industrielles/commerciales et non commerciales simultanées déclarées : la détermination suit les règles de comptabilité d’engagement.', article: 'Article 67.3' });
    AMOUNT_FIELDS.forEach(function (f) {
      var n = amount(data[f[0]]); amounts[f[0]] = n;
      var regulatoryMinimumProfile = ['usedVehicles','consumerGoods'].indexOf(data.profile) !== -1;
      var conditional = (f[0] === 'specialMinimum' && !['usedVehicles','consumerGoods'].includes(data.profile)) || (f[0] === 'stationLitres' && data.profile !== 'serviceStation') || (f[0] === 'cashableProducts' && regulatoryMinimumProfile) || (f[0] === 'gainDeferredArticle62' && data.successionArticle62Verified !== 'yes') || (f[0] === 'profitSharePercent' && data.taxpayerKind === 'individual');
      if (!conditional && n == null) recordGap(gaps, f[0], 'Montant à saisir (indiquer 0 si aucun) ou à justifier.', f[2]);
      if (n != null && n < 0 && f[0] !== 'accountingResultBenin') recordGap(gaps, f[0], 'Un montant déclaré ne peut pas être négatif; une moins-value doit être justifiée séparément.', f[2]);
    });
    if (amounts.gainDeferredArticle62 > 0 && data.successionArticle62Verified !== 'yes') recordGap(gaps,'gainDeferredArticle62','Une plus-value ne peut être retirée qu’après validation documentée des conditions de l’article 62.','Article 62');
    if (data.accountingMethod === 'accrual') warnings.push({ message: 'Comptabilité d’engagement requise pour les bénéfices professionnels habituels.', article: 'Article 67.1' });
    if (data.accountingMethod === 'cash') warnings.push({ message: 'La base comptable doit provenir d’une comptabilité de caisse éligible et d’une option valide; les soldes OHADA d’engagement ne sont pas substitués.', article: 'Article 67.2' });
    if (!truth(data.territoryVerified)) recordGap(gaps, 'territoryVerified', 'Vérifier que le résultat concerne le Bénin ou relève d’une convention fiscale attribuant l’imposition au Bénin.', 'Article 59');
    if (data.activityCategory === 'agriculture' && data.exemption === 'none') recordGap(gaps, 'agricultureExemption', 'L’activité agricole, d’élevage ou de pêche est visée par l’exonération de l’article 58.1; qualifier l’exonération avant tout calcul IBA.','Article 58.1');
    var taxableActivity = liableKind && !!data.activityCategory && !!data.exemption && data.exemption === 'none' && truth(data.territoryVerified) && !gaps.some(function (g) { return ['taxpayerKind','ownAccount','habitualActivity','activityCategory','exemption','territoryVerified','transparentEntityVerified','accountingMethod','cashOptionVerified','cashOptionDate','agricultureExemption','combinedBusinessAndLiberal','successionArticle62Verified','gainDeferredArticle62'].indexOf(g.field) !== -1; });
    var accountingResult = amounts.accountingResultBenin;
    var additionKeys = ['personalDrawings','personalExpenses','ownerCapitalInterest','nonLinearDepreciation','spouseSalaryDisallowed','familySalaryDisallowed','nonProfessionalPropertyExpenses','otherAdditions'];
    var additionsComplete = additionKeys.concat(['mixedExpenses']).every(function (key) { return amounts[key] != null; });
    var additions = additionsComplete ? additionKeys.reduce(function (sum, key) { return sum + amounts[key]; }, 0) : null;
    var mixed = amounts.mixedExpenses == null ? null : amounts.mixedExpenses * (100 - RATES.mixedExpenseDeductibleShare) / 100;
    if (additions != null) additions += mixed;
    var successionDeduction = data.successionArticle62Verified === 'no' ? 0 : (data.successionArticle62Verified === 'yes' ? amounts.gainDeferredArticle62 : null);
    var deductions = amounts.otherDeductions == null || amounts.nonProfessionalPropertyIncome == null || successionDeduction == null ? null : amounts.otherDeductions + amounts.nonProfessionalPropertyIncome + successionDeduction;
    var pensionInputsComplete = amounts.pensionAndLifePaid != null && amounts.pensionAndLifeAlreadyDeducted != null;
    var beforePension = accountingResult == null || additions == null || deductions == null || !pensionInputsComplete ? null : accountingResult + additions - deductions + amounts.pensionAndLifeAlreadyDeducted;
    var pensionAllowance = beforePension == null ? null : Math.min(amounts.pensionAndLifePaid, Math.max(0, beforePension) * RATES.familyInsuranceCap / 100);
    var beforeLosses = beforePension == null || pensionAllowance == null ? null : beforePension - pensionAllowance;
    var lossTotal = ['lossYear1','lossYear2','lossYear3'].every(function (key) { return amounts[key] != null; }) ? amounts.lossYear1 + amounts.lossYear2 + amounts.lossYear3 : null;
    var share = data.taxpayerKind === 'individual' ? 100 : amounts.profitSharePercent;
    var proposedBase = beforeLosses == null || lossTotal == null || share == null ? null : (beforeLosses - lossTotal) * share / 100;
    values.accountingResultBenin = accountingResult;
    values.totalFiscalAdditions = additions;
    values.totalFiscalDeductions = deductions;
    values.mixedExpenseReintegration = mixed;
    values.pensionDeductionLimit = beforePension == null ? null : Math.max(0, beforePension) * RATES.familyInsuranceCap / 100;
    values.pensionDeductible = pensionAllowance;
    values.profitBeforeCarryForward = beforeLosses;
    values.carryForwardLosses = lossTotal;
    values.proposedTaxableBase = proposedBase;
    values.confirmedTaxableBase = amounts.confirmedTaxableBase;
    if (proposedBase == null && taxableActivity) recordGap(gaps, 'proposedTaxableBase', 'Résultat, ajustements et déficits N−1 à N−3 doivent être documentés pour proposer une base.', 'Articles 60 et 61');
    if (data.taxpayerKind !== 'individual' && amounts.profitSharePercent != null && (amounts.profitSharePercent > 100 || amounts.profitSharePercent <= 0)) recordGap(gaps, 'profitSharePercent', 'La quote-part doit être supérieure à 0 % et ne peut excéder 100 %.', 'Article 57');
    if (data.lossesVerified !== 'yes') recordGap(gaps, 'lossesVerified', 'Confirmer l’ancienneté (trois exercices au plus), le montant restant et l’absence de double imputation des déficits.', 'Article 60.2.b');
    var usesArticle47Minimum = ['usedVehicles','consumerGoods'].indexOf(data.profile) === -1;
    if (usesArticle47Minimum && data.art47ProductsVerified !== 'yes') recordGap(gaps, 'art47ProductsVerified', 'Confirmer que les produits encaissables sont déterminés conformément à l’article 47; son texte n’est pas inclus dans l’extrait.', 'Article 64.1');
    if (data.profile === 'usedVehicles' || data.profile === 'consumerGoods') {
      if (amounts.specialMinimum == null || data.specialMinimumVerified !== 'yes') recordGap(gaps, 'specialMinimumVerified', 'Régime de minimum spécial à justifier par le texte réglementaire applicable.', 'Article 64.2.c');
    }
    var selectedProfile = profile(data.profile), taxAmount = null, proportionalTax = null, minimumAmount = null, halfReduction = data.halfReduction === 'yes';
    var shareValid = data.taxpayerKind === 'individual' || (amounts.profitSharePercent != null && amounts.profitSharePercent > 0 && amounts.profitSharePercent <= 100);
    if (data.halfReduction === 'yes') warnings.push({ message: 'Réduction de moitié retenue sur déclaration de l’éligibilité; vérifier les conditions professionnelles strictes et l’articulation avec le minimum.', article: 'Article 65' });
    if (data.halfReduction !== 'yes' && data.halfReduction !== 'no') recordGap(gaps, 'halfReduction', 'Confirmer l’éligibilité à la réduction de moitié ou indiquer qu’elle n’est pas revendiquée.', 'Article 65');
    if (selectedProfile && amounts.confirmedTaxableBase != null && amounts.confirmedTaxableBase >= 0 && (!usesArticle47Minimum || amounts.cashableProducts != null && data.art47ProductsVerified === 'yes') && taxableActivity && shareValid && data.halfReduction && (data.profile !== 'usedVehicles' && data.profile !== 'consumerGoods' || amounts.specialMinimum != null && data.specialMinimumVerified === 'yes') && (data.profile !== 'serviceStation' || amounts.stationLitres != null && data.stationEligibilityVerified === 'yes')) {
      proportionalTax = amounts.confirmedTaxableBase * selectedProfile.rate / 100;
      if (data.profile === 'serviceStation') {
        minimumAmount = Math.max(RATES.minimumCfa, amounts.cashableProducts * RATES.minimumStandard / 100, amounts.stationLitres == null ? 0 : amounts.stationLitres * RATES.serviceStationPerLitre);
      } else if (selectedProfile.minimumRate != null) {
        minimumAmount = Math.max(RATES.minimumCfa, amounts.cashableProducts * selectedProfile.minimumRate / 100);
      } else {
        minimumAmount = Math.max(RATES.minimumCfa, amounts.specialMinimum);
      }
      taxAmount = Math.max(proportionalTax, minimumAmount);
      if (halfReduction) taxAmount = taxAmount / 2;
      values.ortbLevy = RATES.ortbLevy;
      values.taxBeforeArticle65 = Math.max(proportionalTax, minimumAmount);
      values.proportionalTax = proportionalTax;
      values.minimumPerception = minimumAmount;
      values.taxAfterArticle65 = taxAmount;
      values.ortbLevy = RATES.ortbLevy;
      values.totalWithOrtbLevy = taxAmount + RATES.ortbLevy;
    } else {
      values.ortbLevy = null;
      values.taxBeforeArticle65 = null;
      values.proportionalTax = null;
      values.minimumPerception = null;
      values.taxAfterArticle65 = null;
      values.totalWithOrtbLevy = null;
      if (selectedProfile && !amounts.confirmedTaxableBase) recordGap(gaps, 'confirmedTaxableBase', 'La base proposée n’est pas une base déclarée : confirmer la base imposable après contrôle.', 'Articles 60 et 63');
      if (selectedProfile && amounts.confirmedTaxableBase != null && amounts.confirmedTaxableBase < 0) recordGap(gaps, 'confirmedTaxableBase', 'La base d’impôt confirmée doit être nulle ou positive; vérifier le traitement du déficit.', 'Articles 60 et 63');
    }
    if (data.profile === 'serviceStation' && amounts.stationLitres == null) recordGap(gaps, 'stationLitres', 'Saisir le volume vendu ou 0 si non applicable.', 'Article 64.3.b');
    if (data.profile === 'serviceStation' && !truth(data.stationEligibilityVerified)) recordGap(gaps, 'stationEligibilityVerified', 'Confirmer que l’activité remplit les conditions des distributeurs visés.', 'Article 64.3.b');
    warnings.push({ message: 'L’extrait ne contient pas la définition des produits encaissables de l’article 47 ni les modalités de déclaration/paiement de l’article 51. Aucun échéancier d’acomptes n’est généré.', article: 'Articles 47, 51 et 66' });
    warnings.push({ message: 'Le bénéfice est rapproché des règles de l’IS par renvoi de l’article 60.1; les règles IS non fournies et le traitement fiscal des comptes doivent être validés par le déclarant ou son conseil.', article: 'Article 60.1' });
    warnings.push({ message: 'La proposition ne transmet rien au service des impôts et ne remplace pas le formulaire officiel ni le dépôt réglementaire.', article: 'Article 66' });
    if (data.taxpayerKind === 'partnerNotIs' || data.taxpayerKind === 'indivision') warnings.push({ message: 'La quote-part doit être rapprochée des droits sociaux/parts et des comptes de la société ou de l’indivision.', article: 'Article 57' });
    if (data.successionArticle62Verified === 'yes') warnings.push({ message: 'Report de taxation de plus-value de fonds de commerce revendiqué; l’absence de réévaluation et la continuation par les ayants droit doivent être prouvées.', article: 'Article 62' });
    var unique = [], seen = Object.create(null);
    gaps.forEach(function (g) { var key = g.field + '|' + g.message; if (!seen[key]) { seen[key] = true; unique.push(g); } });
    return {
      lawVersion: LAW_VERSION, complete: unique.length === 0 && taxAmount != null, status: exempt ? 'exemption-declared' : (taxableActivity ? (taxAmount == null || unique.length ? 'incomplete' : 'proposal-ready-for-review') : 'eligibility-unconfirmed'),
      profile: selectedProfile, values: values, amounts: amounts, gaps: unique, warnings: warnings,
      totals: { accountingResult: accountingResult, additions: additions, deductions: deductions, mixedExpenseReintegration: mixed, pensionDeductible: pensionAllowance, beforeCarryForward: beforeLosses, losses: lossTotal, proposedBase: proposedBase, confirmedBase: amounts.confirmedTaxableBase, rate: selectedProfile && selectedProfile.rate, proportionalTax: proportionalTax, minimumPerception: minimumAmount, taxBeforeArticle65: values.taxBeforeArticle65, tax: taxAmount, ortbLevy: values.ortbLevy, totalWithOrtbLevy: values.totalWithOrtbLevy },
      declaration: { name: String(data.taxpayerName || ''), ifu: String(data.taxpayerIfu || ''), address: String(data.taxpayerAddress || ''), activity: String(data.businessDescription || ''), taxOffice: String(data.taxOffice || ''), periodStart: String(input.cycleStart || ''), periodEnd: String(input.cycleEnd || ''), taxpayerKind: String(data.taxpayerKind || ''), activityCategory: String(data.activityCategory || ''), exemption: String(data.exemption || ''), accountingMethod: String(data.accountingMethod || ''), supportingReference: String(data.supportingReference || ''), combinedBusinessAndLiberal: String(data.combinedBusinessAndLiberal || ''), successionArticle62Verified: String(data.successionArticle62Verified || '') }
    };
  }
  function csv(prepared) {
    var rows = [['Section','Rubrique','Montant / valeur','Origine ou référence','Statut']];
    var d = prepared.declaration || {}, t = prepared.totals || {}, v = prepared.values || {};
    function row(section, label, value, law, status) { rows.push([section,label,value == null ? '' : value,law || '',status || (value == null ? 'À compléter' : 'À vérifier')]); }
    row('Déclaration','Contribuable',d.name,'Articles 54 et 66','À vérifier');
    row('Déclaration','IFU',d.ifu,'À vérifier','À vérifier');
    row('Déclaration','Adresse',d.address,'À vérifier','À vérifier');
    row('Déclaration','Activité',d.activity,'Articles 54 à 56','À vérifier');
    row('Déclaration','Centre des impôts',d.taxOffice,'À confirmer','À vérifier');
    row('Déclaration','Période',d.periodStart + ' au ' + d.periodEnd,'Exercice du dossier','À vérifier');
    row('Champ d’application','Qualité du contribuable',d.taxpayerKind,'Articles 54 et 57','À vérifier');
    row('Champ d’application','Catégorie d’activité',d.activityCategory,'Articles 55 et 56','À vérifier');
    row('Champ d’application','Exonération choisie',d.exemption,'Article 58','À vérifier');
    row('Champ d’application','Méthode comptable',d.accountingMethod,'Article 67','À vérifier');
    row('Champ d’application','Activités mixtes commerce/profession non commerciale',d.combinedBusinessAndLiberal,'Article 67.3','À vérifier');
    row('Détermination','Conditions successorales déclarées',d.successionArticle62Verified,'Article 62','À vérifier');
    row('Déclaration','Référence des justificatifs',d.supportingReference,'Dossier des pièces','À joindre');
    row('Déclaration','Statut de préparation',prepared.status,prepared.lawVersion,'Proposition non transmise');
    row('Déclaration','Profil fiscal',prepared.profile && prepared.profile.label,'Articles 63 et 64','À vérifier');
    row('Détermination','Résultat comptable attribuable au Bénin',t.accountingResult,'Article 59','Source comptable à rapprocher');
    row('Détermination','Réintégrations fiscales connues',t.additions,'Articles 60 et 61','Détail justificatif requis');
    row('Détermination','Déductions fiscales connues',t.deductions,'Articles 60 et 61','Détail justificatif requis');
    row('Détermination','Plus-value reportée après succession',prepared.amounts && prepared.amounts.gainDeferredArticle62,'Article 62','Conditions et justificatifs à vérifier');
    row('Détermination','Réintégration dépenses mixtes',t.mixedExpenseReintegration,'Article 60.4 · 70 % si 30 % professionnel','Calcul selon données saisies');
    row('Détermination','Déduction retraite/assurance-vie admise',t.pensionDeductible,'Article 60.3 · plafond 5 %','Calcul selon données saisies');
    row('Détermination','Bénéfice avant report des déficits',t.beforeCarryForward,'Articles 60 et 61','Calcul indicatif');
    row('Détermination','Déficits de N−1 à N−3 saisis',t.losses,'Article 60.2.b','Ancienneté et solde à justifier');
    row('Détermination','Base proposée (non confirmée)',t.proposedBase,'Articles 60 et 61','Proposition à vérifier');
    row('Détermination','Base imposable confirmée',t.confirmedBase,'Articles 60 et 63','À confirmer par le déclarant');
    row('Liquidation','Taux proportionnel du profil',t.rate,'% selon profil sélectionné','Vérifier profil et texte applicable');
    row('Liquidation','Impôt proportionnel',t.proportionalTax,'Article 63','Calcul indicatif');
    row('Liquidation','Minimum de perception',t.minimumPerception,'Article 64','Produits encaissables/volume à vérifier');
    row('Liquidation','Impôt après réduction éventuelle',t.tax,'Articles 63 à 65','À contrôler');
    row('Liquidation','Redevance ORTB',v.ortbLevy,'Article 64.4 · à payer avec acompte du 10 mars','À contrôler');
    row('Liquidation','Total impôt + redevance ORTB',t.totalWithOrtbLevy,'Articles 63 à 65','Proposition, non transmise');
    prepared.gaps.forEach(function (g) { rows.push(['À vérifier',g.field,g.message,g.article,g.status]); });
    prepared.warnings.forEach(function (w) { rows.push(['Réserve juridique',w.message,'',w.article,'À vérifier']); });
    return '\ufeff' + rows.map(function (r) { return r.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g,'""') + '"'; }).join(';'); }).join('\r\n');
  }
  return { LAW_VERSION: LAW_VERSION, RATES: RATES, PROFILES: PROFILES, EXEMPTIONS: EXEMPTIONS, FIELDS: FIELDS, calculate: calculate, buildCsv: csv };
}));

/**
 * fcmCalcoloMotore.js
 * Motore Unificato di Calcolo Risultati Fantacalcio (Regolamento FCM)
 * Condiviso tra Calcolo Ufficiale (#calcolo) e Live Voti Ufficiosi (#liveVU).
 *
 * Supporta esecuzione in browser (window.FCMCalcoloMotore) e Node.js (CommonJS / tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FCMCalcoloMotore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FCMCalcoloMotore = {
    /**
     * Lettura parametro con priorità: options > globalThis > default
     */
    _getParam(key, defaultValue, options) {
      if (options && options[key] !== undefined) return Number(options[key]);
      if (typeof globalThis !== 'undefined' && typeof globalThis[key] !== 'undefined') {
        return Number(globalThis[key]);
      }
      return defaultValue;
    },

    /**
     * Normalizza il ruolo in numero (1: Portiere, 2: Difensore, 3: Centrocampista, 4: Attaccante)
     */
    getRoleNum(ruolo) {
      if (ruolo === 1 || ruolo === '1' || ruolo === 'P' || ruolo === 'p') return 1;
      if (ruolo === 2 || ruolo === '2' || ruolo === 'D' || ruolo === 'd') return 2;
      if (ruolo === 3 || ruolo === '3' || ruolo === 'C' || ruolo === 'c') return 3;
      if (ruolo === 4 || ruolo === '4' || ruolo === 'A' || ruolo === 'a') return 4;
      const num = Number(ruolo);
      return !isNaN(num) && num >= 1 && num <= 4 ? num : 0;
    },

    /**
     * Restituisce la lettera del ruolo ('P', 'D', 'C', 'A')
     */
    getRoleLetter(ruolo) {
      const num = this.getRoleNum(ruolo);
      switch (num) {
        case 1: return 'P';
        case 2: return 'D';
        case 3: return 'C';
        case 4: return 'A';
        default: return String(ruolo || '');
      }
    },

    /**
     * Verifica se un calciatore ha un voto valido a referto (diverso da SV / vuoto / 0)
     */
    hasVote(p) {
      if (!p) return false;
      if (p.isRisUfficio || p.isRiservaUfficio || p.isNoSost) return false;
      if (p.hasVote === true) return true;
      if (p.hasVote === false) return false;
      const v = p.voto !== undefined ? p.voto : (p.Voto !== undefined ? p.Voto : p.votoNum);
      if (v === 'S.V.' || v === 'sv' || v === 'SV' || v === '' || v === null || v === undefined) {
        return false;
      }
      const num = Number(typeof v === 'string' ? v.replace(',', '.') : v);
      return !isNaN(num) && num > 0;
    },

    /**
     * Calcola il fantavoto (voto base + bonus/malus) di un calciatore.
     * Supporta sia l'oggetto voto grezzo (es. da arrVoti / PianetaFanta)
     * sia l'oggetto giocatore modificabile di #calcolo.
     */
    calcolaFantavoto(v, ruolo, options) {
      if (!v) return 'SV';

      const rawVoto = v.Voto !== undefined ? v.Voto : (v.voto !== undefined ? v.voto : v.votoNum);
      if (rawVoto === 'SV' || rawVoto === 'S.V.' || rawVoto === null || rawVoto === undefined || rawVoto === '') {
        return 'SV';
      }
      const votoNum = Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto);
      if (isNaN(votoNum)) return 'SV';

      const pGolF_val = this._getParam('pGolF', 3, options);
      const pGolS_val = this._getParam('pGolS', 1, options);
      const pRigF_val = this._getParam('pRigF', 3, options);
      const pRigP_val = this._getParam('pRigP', 3, options);
      const pRigS_val = this._getParam('pRigS', 3, options);
      const pAutoG_val = this._getParam('pAutoG', 2, options);
      const pAss_val = this._getParam('pAss', 1, options);
      const pAmm_val = this._getParam('pAmm', 0.5, options);
      const pEsp_val = this._getParam('pEsp', 1, options);
      const pPorI_val = this._getParam('pPorI', 1, options);
      const pGolV_val = this._getParam('pGolV', 1, options);
      const pGolP_val = this._getParam('pGolP', 0.5, options);
      const golVP_active = this._getParam('golVP', 0, options) === 1;

      const roleNum = this.getRoleNum(ruolo !== undefined ? ruolo : (v.ruolo || v.Ruolo));
      const isPortiere = roleNum === 1;
      const isFP = options && options.isFP;

      const gF = Number(v.golF !== undefined ? v.golF : (v.GolFatto || 0));
      const gS = Number(v.golS !== undefined ? v.golS : (v.GolSubito || 0));
      const rig = Number(v.rigF !== undefined ? v.rigF : (v.Rigore || 0));
      const rPar = Number(v.rigP !== undefined ? v.rigP : (v.RigoreParato || 0));
      const rSba = Number(v.rigS !== undefined ? v.rigS : (v.RigoreSbagliato || 0));
      const autoG = Number(v.autoG !== undefined ? v.autoG : (v.AutoGol || 0));
      const ass = Number(v.assist !== undefined ? v.assist : (v.Assist || 0));
      const isAmm = v.amm !== undefined ? Boolean(v.amm) : (v.Ammonizione === '1' || Number(v.Ammonizione) > 0);
      const isEsp = v.esp !== undefined ? Boolean(v.esp) : (v.Espulsione === '1' || Number(v.Espulsione) > 0);
      const isGV = v.golV !== undefined ? Boolean(v.golV) : (v.GolVittoria === '1' || Number(v.GolVittoria) > 0);
      const isGP = v.golP !== undefined ? Boolean(v.golP) : (v.GolPareggio === '1' || Number(v.GolPareggio) > 0);

      const gvBonus = (golVP_active && isGV) ? pGolV_val : 0;
      const gpBonus = (golVP_active && isGP) ? pGolP_val : 0;
      const cardMalus = (isAmm ? pAmm_val : 0) + (isEsp ? pEsp_val : 0);

      let fv = votoNum;
      if (isPortiere) {
        fv = fv - (pGolS_val * gS) + (pRigP_val * rPar) - (pAutoG_val * autoG) + (pAss_val * ass) - cardMalus + gvBonus + gpBonus;
        if (gS === 0 && pPorI_val > 0) {
          fv += pPorI_val;
        }
      } else {
        let netGoals = gF;
        let rigoriSegnati = rig;
        if (v.golF === undefined && v.rigF === undefined && !isFP) {
          rigoriSegnati = Math.max(0, rig - rSba);
          netGoals = Math.max(0, gF - rigoriSegnati);
        }
        fv = fv + (pGolF_val * netGoals) + (pRigF_val * rigoriSegnati) + gvBonus + gpBonus - (pAutoG_val * autoG) - (pRigS_val * rSba) + (pAss_val * ass) - cardMalus;
      }

      return Number(fv.toFixed(2));
    },

    /**
     * Esegue le sostituzioni ruolo-su-ruolo conformi a FCM.
     * Gestisce panchina, limite max sostituzioni (pMaxS), riserva d'ufficio (pMaxRisU) e 0 pt per no-sostituzione.
     */
    eseguiSostituzioni(starters, bench, options) {
      const maxSost = this._getParam('pMaxS', 4, options);
      const maxRisU = this._getParam('pMaxRisU', 1, options);
      const pRisUP_val = this._getParam('pRisUP', 3, options);
      const pRisU_val = this._getParam('pRisU', 4, options);

      const startersList = starters || [];
      const benchList = (bench || []).slice();

      const titolariFinali = [];
      const sostituzioniEffettuate = [];
      let numSost = 0;
      let numRiserveUfficio = 0;
      const benchUsata = new Set();

      for (let i = 0; i < startersList.length; i++) {
        const orig = startersList[i];
        const p = { ...orig };
        const pRole = this.getRoleNum(p.ruolo || p.Ruolo);
        const pName = p.nome || p.Nome || `Giocatore ${i + 1}`;

        if (this.hasVote(p)) {
          titolariFinali.push(p);
          continue;
        }

        let subentrato = null;
        if (numSost < maxSost) {
          for (let bIdx = 0; bIdx < benchList.length; bIdx++) {
            const b = benchList[bIdx];
            const bKey = (b.uid !== undefined && b.uid !== null)
              ? b.uid
              : ((b.id !== undefined && b.id !== null) ? b.id : `bench_${bIdx}_${b.nome || b.Nome}`);
            const bRole = this.getRoleNum(b.ruolo || b.Ruolo);

            if (!benchUsata.has(bKey) && bRole === pRole && this.hasVote(b)) {
              benchUsata.add(bKey);
              numSost++;
              const bVote = (b.fantavoto !== undefined && typeof b.fantavoto === 'number')
                ? b.fantavoto
                : ((b.votoFinale !== undefined && typeof b.votoFinale === 'number')
                  ? b.votoFinale
                  : (Number(b.votoNum || b.voto) || 0));

              subentrato = {
                ...b,
                posSostituzione: p.pos || (i + 1),
                isSub: true,
                hasVote: true,
                fantavoto: bVote,
                votoFinale: bVote,
                votoNum: b.votoNum !== undefined ? b.votoNum : (Number(b.voto) || 0),
                voto: b.voto !== undefined ? b.voto : b.votoNum
              };

              sostituzioniEffettuate.push({
                uscito: pName,
                entrato: b.nome || b.Nome,
                ruolo: this.getRoleLetter(pRole),
                voto: bVote,
                tipo: 'panchina'
              });
              break;
            }
          }
        }

        if (subentrato) {
          titolariFinali.push(subentrato);
          continue;
        }

        // Riserva d'Ufficio
        if (numSost < maxSost && numRiserveUfficio < maxRisU) {
          numSost++;
          numRiserveUfficio++;
          const votoRisU = pRole === 1 ? pRisUP_val : pRisU_val;
          sostituzioniEffettuate.push({
            uscito: pName,
            entrato: `Riserva d'Ufficio (${votoRisU} pt)`,
            ruolo: this.getRoleLetter(pRole),
            voto: votoRisU,
            tipo: 'ufficio'
          });
          titolariFinali.push({
            ...p,
            nome: `${pName} (Ris. Ufficio)`,
            voto: votoRisU,
            votoFinale: votoRisU,
            fantavoto: votoRisU,
            votoNum: 0,
            hasVote: false,
            golFatti: 0,
            golSubiti: 0,
            rigoriSegnati: 0,
            rigoriParati: 0,
            isRiservaUfficio: true,
            isRisUfficio: true,
            isNoSost: false
          });
          continue;
        }

        // Nessuna sostituzione possibile: 0 pt
        sostituzioniEffettuate.push({
          uscito: pName,
          entrato: 'No sostituzione (0 pt)',
          ruolo: this.getRoleLetter(pRole),
          voto: 0,
          tipo: 'nessuna'
        });
        titolariFinali.push({
          ...p,
          voto: 0,
          votoFinale: 0,
          fantavoto: 0,
          votoNum: 0,
          hasVote: false,
          golFatti: 0,
          golSubiti: 0,
          rigoriSegnati: 0,
          rigoriParati: 0,
          isRiservaUfficio: false,
          isRisUfficio: false,
          isNoSost: true
        });
      }

      return {
        titolariFinali,
        attivi: titolariFinali,
        sostituzioniEffettuate,
        sostituzioni: sostituzioniEffettuate,
        numSost,
        numRiserveUfficio
      };
    },

    /**
     * Calcola tutti i modificatori FCM ufficiali: Difesa, Centrocampo, Portiere, Attacco.
     * Conforme al 100% a fcmCalcolorisultatiFunzioni.js
     */
    calcolaModificatori(attiviCasa, attiviFuori, options) {
      const isModP = this._getParam('modP', 0, options) === 1;
      const isModD = this._getParam('modD', 0, options) === 1;
      const isModC = this._getParam('modC', 0, options) === 1;
      const isModA = this._getParam('modA', 0, options) === 1;

      const pModDRisU_val = this._getParam('pModDRisU', 5, options);
      const pModCRisU_val = this._getParam('pModCRisU', 5, options);
      const pModAArr_val = this._getParam('pModAArr', 0, options);

      const getBaseVote = (p, defaultVal) => {
        if (p.isRisUfficio || p.isRiservaUfficio || p.isNoSost) return defaultVal;
        if (p.votoNum !== undefined && p.votoNum > 0 && p.hasVote) return p.votoNum;
        if (p.voto !== undefined && p.voto !== 'S.V.' && p.voto !== 'sv' && p.voto !== 'SV' && p.voto !== '' && !isNaN(Number(p.voto)) && Number(p.voto) > 0) {
          return Number(p.voto);
        }
        return defaultVal;
      };

      // 1. Modificatore Difesa
      let difesaCasa = 0, contaDifesaCasa = 0;
      let difesaFuori = 0, contaDifesaFuori = 0;

      (attiviCasa || []).forEach(p => {
        if (this.getRoleNum(p.ruolo || p.Ruolo) === 2) {
          difesaCasa += getBaseVote(p, pModDRisU_val);
          contaDifesaCasa++;
        }
      });

      (attiviFuori || []).forEach(p => {
        if (this.getRoleNum(p.ruolo || p.Ruolo) === 2) {
          difesaFuori += getBaseVote(p, pModDRisU_val);
          contaDifesaFuori++;
        }
      });

      const checkDifensori = (difensori, mod) => {
        if (difensori == 4) return mod;
        if (difensori == 5) return mod - 1;
        if (difensori >= 6) return mod - 2;
        return mod + 1;
      };

      const calcModDifesa = (difesa, contadifesa) => {
        if (!contadifesa || contadifesa <= 0) return 0;
        const media = difesa / contadifesa;
        if (media < 5) return checkDifensori(contadifesa, 4);
        if (media >= 5 && media < 5.25) return checkDifensori(contadifesa, 3);
        if (media >= 5.25 && media < 5.5) return checkDifensori(contadifesa, 2);
        if (media >= 5.5 && media < 5.75) return checkDifensori(contadifesa, 1);
        if (media >= 5.75 && media < 6) return checkDifensori(contadifesa, 0);
        if (media >= 6 && media < 6.25) return checkDifensori(contadifesa, -1);
        if (media >= 6.25 && media < 6.5) return checkDifensori(contadifesa, -2);
        if (media >= 6.5 && media < 6.75) return checkDifensori(contadifesa, -3);
        if (media >= 6.75 && media < 7) return checkDifensori(contadifesa, -4);
        if (media >= 7) return checkDifensori(contadifesa, -5);
        return 0;
      };

      let modDifesaCasa = 0;
      let modDifesaFuori = 0;
      if (isModD) {
        if (contaDifesaCasa > 0) modDifesaCasa = calcModDifesa(difesaCasa, contaDifesaCasa);
        if (contaDifesaFuori > 0) modDifesaFuori = calcModDifesa(difesaFuori, contaDifesaFuori);
      }

      // 2. Modificatore Centrocampo
      let centroCasa = 0, contaCentroCasa = 0;
      let centroFuori = 0, contaCentroFuori = 0;

      (attiviCasa || []).forEach(p => {
        if (this.getRoleNum(p.ruolo || p.Ruolo) === 3) {
          centroCasa += getBaseVote(p, pModCRisU_val);
          contaCentroCasa++;
        }
      });

      (attiviFuori || []).forEach(p => {
        if (this.getRoleNum(p.ruolo || p.Ruolo) === 3) {
          centroFuori += getBaseVote(p, pModCRisU_val);
          contaCentroFuori++;
        }
      });

      let modCentroCasa = 0;
      let modCentroFuori = 0;
      if (isModC) {
        let a = centroCasa, b = contaCentroCasa, c = centroFuori, d = contaCentroFuori;
        if (b == 3 && d == 4) { a += 5; } if (b == 3 && d == 5) { a += 10; } if (b == 4 && d == 5) { a += 5; }
        if (b == 4 && d == 3) { c += 5; } if (b == 5 && d == 3) { c += 10; } if (b == 5 && d == 4) { c += 5; }
        const k = a - c;

        if (k <= -8) { modCentroCasa = -4; modCentroFuori = 4; }
        else if (k <= -7 && k > -8) { modCentroCasa = -3.50; modCentroFuori = 3.50; }
        else if (k <= -6 && k > -7) { modCentroCasa = -3; modCentroFuori = 3; }
        else if (k <= -5 && k > -6) { modCentroCasa = -2.50; modCentroFuori = 2.50; }
        else if (k <= -4 && k > -5) { modCentroCasa = -2; modCentroFuori = 2; }
        else if (k <= -3 && k > -4) { modCentroCasa = -1.50; modCentroFuori = 1.50; }
        else if (k <= -2 && k > -3) { modCentroCasa = -1; modCentroFuori = 1; }
        else if (k <= -1 && k > -2) { modCentroCasa = -0.50; modCentroFuori = 0.50; }
        else if (k < 1 && k > -1) { modCentroCasa = 0; modCentroFuori = 0; }
        else if (k >= 1 && k < 2) { modCentroCasa = 0.50; modCentroFuori = -0.50; }
        else if (k >= 2 && k < 3) { modCentroCasa = 1; modCentroFuori = -1; }
        else if (k >= 3 && k < 4) { modCentroCasa = 1.50; modCentroFuori = -1.50; }
        else if (k >= 4 && k < 5) { modCentroCasa = 2; modCentroFuori = -2; }
        else if (k >= 5 && k < 6) { modCentroCasa = 2.50; modCentroFuori = -2.50; }
        else if (k >= 6 && k < 7) { modCentroCasa = 3; modCentroFuori = -3; }
        else if (k >= 7 && k < 8) { modCentroCasa = 3.50; modCentroFuori = -3.50; }
        else if (k >= 8) { modCentroCasa = 4; modCentroFuori = -4; }
      }

      // 3. Modificatore Portiere
      let modPortiereCasa = 0;
      let modPortiereFuori = 0;

      const calcModPortiere = (voto, rigoriParati) => {
        if (Number(rigoriParati) === 0) {
          if (voto >= 6.5 && voto < 7) return 0.5;
          if (voto >= 7 && voto < 7.5) return 1;
          if (voto >= 7.5 && voto < 8) return 1.5;
          if (voto >= 8) return 2;
          return 0;
        }
        return 0;
      };

      if (isModP) {
        const porCasa = (attiviCasa || []).find(p => this.getRoleNum(p.ruolo || p.Ruolo) === 1 && !p.isRisUfficio && !p.isRiservaUfficio && !p.isNoSost && this.hasVote(p));
        if (porCasa) modPortiereCasa = calcModPortiere(getBaseVote(porCasa, 0), porCasa.rigP || porCasa.rigoriParati || 0);

        const porFuori = (attiviFuori || []).find(p => this.getRoleNum(p.ruolo || p.Ruolo) === 1 && !p.isRisUfficio && !p.isRiservaUfficio && !p.isNoSost && this.hasVote(p));
        if (porFuori) modPortiereFuori = calcModPortiere(getBaseVote(porFuori, 0), porFuori.rigP || porFuori.rigoriParati || 0);
      }

      // 4. Modificatore Attacco
      let modAttaccoCasa = 0;
      let modAttaccoFuori = 0;

      const calcModAttacco = (voto, goal, rigore) => {
        if (Number(goal) === 0 && Number(rigore) === 0) {
          if (pModAArr_val === 1) {
            if (voto >= 6.5 && voto < 7) return 0.5;
            if (voto >= 7 && voto < 7.5) return 1;
            if (voto >= 7.5 && voto < 8) return 1.5;
            if (voto >= 8) return 2;
            return 0;
          } else {
            if (voto > 6 && voto < 8) return Number((voto - 6).toFixed(2));
            if (voto >= 8) return 2;
            return 0;
          }
        }
        return 0;
      };

      if (isModA) {
        (attiviCasa || []).forEach(p => {
          if (this.getRoleNum(p.ruolo || p.Ruolo) === 4 && !p.isRisUfficio && !p.isRiservaUfficio && !p.isNoSost && this.hasVote(p)) {
            modAttaccoCasa += calcModAttacco(getBaseVote(p, 0), p.golF || p.golFatti || 0, p.rigF || p.rigoriSegnati || 0);
          }
        });
        (attiviFuori || []).forEach(p => {
          if (this.getRoleNum(p.ruolo || p.Ruolo) === 4 && !p.isRisUfficio && !p.isRiservaUfficio && !p.isNoSost && this.hasVote(p)) {
            modAttaccoFuori += calcModAttacco(getBaseVote(p, 0), p.golF || p.golFatti || 0, p.rigF || p.rigoriSegnati || 0);
          }
        });
      }

      return {
        modDifesaCasa,
        modDifesaFuori,
        modCentroCasa,
        modCentroFuori,
        modPortiereCasa,
        modPortiereFuori,
        modAttaccoCasa,
        modAttaccoFuori,
        isModD,
        isModC,
        isModP,
        isModA,
        modPortiereAttivo: isModP,
        modDifesaAttivo: isModD,
        modCentroAttivo: isModC,
        modAttaccoAttivo: isModA
      };
    },

    /**
     * Calcolo scaglioni gol (fgol1..15), pareggio forzato (diffT) e autogol squadra.
     * Conforme a fcmCalcolorisultatiFunzioni.js:1371-1386 (Risultato)
     */
    calcolaGolSquadre(totCasa, totFuori, options) {
      const a = Number(totCasa);
      const b = Number(totFuori);

      let fgol = [66, 72, 77, 81, 85, 89, 93, 97, 101, 105, 109, 113, 117, 121, 125];
      const customFgol1 = this._getParam('fgol1', null, options);
      if (customFgol1 !== null) {
        fgol = [
          customFgol1,
          this._getParam('fgol2', 72, options),
          this._getParam('fgol3', 77, options),
          this._getParam('fgol4', 81, options),
          this._getParam('fgol5', 85, options),
          this._getParam('fgol6', 89, options),
          this._getParam('fgol7', 93, options),
          this._getParam('fgol8', 97, options),
          this._getParam('fgol9', 101, options),
          this._getParam('fgol10', 105, options),
          this._getParam('fgol11', 109, options),
          this._getParam('fgol12', 113, options),
          this._getParam('fgol13', 117, options),
          this._getParam('fgol14', 121, options),
          this._getParam('fgol15', 125, options)
        ];
      }

      const calcG = (pt) => {
        for (let idx = 0; idx < fgol.length; idx++) {
          if (pt < fgol[idx]) return idx;
        }
        return fgol.length;
      };

      let c = calcG(a);
      let d = calcG(b);

      const diff_T = this._getParam('diffT', 0, options);
      const e = a - b;
      const sogliaMinima = fgol[0] || 66;

      if (c !== d) {
        if (e > 0 && e < diff_T) {
          if (b < sogliaMinima) { c = c - 1; }
          else { d = d + 1; }
        } else if (e < 0 && e > (-diff_T)) {
          if (a < sogliaMinima) { d = d - 1; }
          else { c = c + 1; }
        }
      }

      // Regola Autogol Squadra
      let autogolCasa = 0;
      let autogolFuori = 0;
      const isAutoGolActive = this._getParam('autoGol', 0, options) === 1;
      if (isAutoGolActive) {
        const pAutogol_val = this._getParam('pAutogol', 59, options);
        const pMinAutogol_val = this._getParam('pMinAutogol', 59, options);
        const pScarAutogol_val = this._getParam('pScarAutogol', 3, options);

        if (a < pAutogol_val && b >= pMinAutogol_val && (b - a) >= pScarAutogol_val) {
          d += 1;
          autogolFuori = 1;
        } else if (b < pAutogol_val && a >= pMinAutogol_val && (a - b) >= pScarAutogol_val) {
          c += 1;
          autogolCasa = 1;
        }
      }

      const res = [c, d];
      res.autogolCasa = autogolCasa;
      res.autogolFuori = autogolFuori;
      res.golCasa = c;
      res.golFuori = d;
      return res;
    },

    /**
     * Determina se si applica il fattore campo in base all'IDTipo dell'incontro
     */
    calcolaFattoreCampo(idTipo, options) {
      const defaultFCampo = this._getParam('fattorecampo', 2, options);
      const tipo = Number(idTipo);

      // Partite su campo neutro o a eliminazione diretta azzerano il fattore campo
      if (
        (typeof INC_NORMALE_NEUTRO !== 'undefined' && tipo === INC_NORMALE_NEUTRO) ||
        (typeof INC_ELIMDIRETTA_DIR !== 'undefined' && tipo === INC_ELIMDIRETTA_DIR) ||
        (typeof INC_GRANPREMIO !== 'undefined' && tipo === INC_GRANPREMIO) ||
        (typeof INC_RIPOSO !== 'undefined' && tipo === INC_RIPOSO)
      ) {
        return 0;
      }
      return defaultFCampo;
    },

    /**
     * Calcola i totali ufficiali delle due squadre secondo la regola FCM:
     * Il modificatore difesa Fuori va sommato a Casa, e viceversa.
     */
    calcolaTotaliSquadre(sommaCasa, sommaFuori, mods, fCampo) {
      const fc = fCampo !== undefined ? Number(fCampo) : 0;
      const m = mods || {};
      const modPorCasa = m.modPortiereCasa || 0;
      const modPorFuori = m.modPortiereFuori || 0;
      const modDifCasa = m.modDifesaCasa || 0;
      const modDifFuori = m.modDifesaFuori || 0;
      const modCenCasa = m.modCentroCasa || 0;
      const modCenFuori = m.modCentroFuori || 0;
      const modAttCasa = m.modAttaccoCasa || 0;
      const modAttFuori = m.modAttaccoFuori || 0;

      const totaleCasa = Number((sommaCasa + fc + modPorCasa + modDifFuori + modCenCasa + modAttCasa).toFixed(2));
      const totaleFuori = Number((sommaFuori + modPorFuori + modDifCasa + modCenFuori + modAttFuori).toFixed(2));

      return { totaleCasa, totaleFuori };
    },

    /**
     * Calcola il modulo tattico (es. "3-4-3") a partire dai titolari
     */
    calcolaModulo(starters) {
      let d = 0, c = 0, a = 0;
      (starters || []).forEach(p => {
        const r = this.getRoleNum(p.ruolo || p.Ruolo);
        if (r === 2) d++;
        else if (r === 3) c++;
        else if (r === 4) a++;
      });
      return `${d}-${c}-${a}`;
    }
  };

  return FCMCalcoloMotore;
});

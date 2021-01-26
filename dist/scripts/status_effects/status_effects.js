var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Global constants
const FATIGUE_ICONS = 'modules/swade-toolkit/assets/icons/f';
const WOUND_ICONS = 'modules/swade-toolkit/assets/icons/w';
//register settings
Hooks.on("ready", () => {
    game.toolkit = {
        statuseffects: new StatusEffects()
    }; //game.toolkit.statuseffects
});
class StatusEffects {
    constructor() {
        this.registerSettings();
        this.startStatusLinkingListeners();
    }
    registerSettings() {
        game.settings.register("swade-toolkit", "link-status-effects", {
            name: game.i18n.localize("Status_Effects.Link_Status_Effects"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
        });
        game.settings.register("swade-toolkit", "wound-status-effects", {
            name: game.i18n.localize("Status_Effects.Wound_Status_Effects"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: () => {
                window.location.reload();
            }
        });
    }
    set_level_effects(type, id) {
        let target = type == 'token' ? canvas.tokens.get(id) : id.getActiveTokens()[0];
        for (let i = 1; i < 7; i++) {
            if (i <= 2) {
                // Fatigue
                let icon = FATIGUE_ICONS + `${i}.png`;
                let should_be = i === target.actor.data.data.fatigue.value;
                let is = target.data.effects.indexOf(icon) >= 0;
                if (should_be !== is) {
                    target.toggleEffect(icon, { active: should_be, overlay: false });
                }
            }
            let icon = WOUND_ICONS + `${i}.png`;
            let should_be = i === target.actor.data.data.wounds.value;
            let is = target.data.effects.indexOf(icon) >= 0;
            if (should_be !== is) {
                target.toggleEffect(icon, { active: should_be, overlay: false });
            }
        }
    }
    startStatusLinkingListeners() {
        if (!game.settings.get("swade-toolkit", "link-status-effects")) {
            return; //don't do anything if the setting isn't turned on
        }
        let coreStatusList = [
            'Shaken',
            'Distracted',
            'Vulnerable',
            'Stunned',
            'Entangled',
            'Bound',
        ];
        //Hack: Add a listener onto the status icons that calls the actor update on the sheet
        Hooks.on("renderTokenHUD", (tokenHUD, html, opts) => {
            let token = canvas.tokens.get(opts._id);
            if (!token.owner) {
                return;
            } //only process for the token owner
            html.find(".effect-control").on("click", (evt) => __awaiter(this, void 0, void 0, function* () {
                evt.preventDefault();
                let status = evt.target.title;
                if (!coreStatusList.includes(status)) {
                    return;
                } //we only care about core statuses
                let tokenEffects = token.actor['effects'];
                if (!token.actor.data.data.status[`is${status}`] && !tokenEffects.find(el => el.data.label == status)) {
                    //status is FALSE on actor AND it doesn't currently exist 
                    yield token.actor.update({
                        [`data.status.is${status}`]: true
                    });
                    //Unfortunately because foundry AND this handler made a status we need to do some clean up and delete the second one
                    setTimeout(() => {
                        token = canvas.tokens.get(opts._id);
                        let tokenStatuses = token.actor['effects'].filter(el => el.data.label == status);
                        if (tokenStatuses.length > 1) {
                            token.actor.deleteEmbeddedEntity("ActiveEffect", tokenStatuses[0].id);
                        }
                    }, 250);
                }
                else {
                    token.actor.update({
                        [`data.status.is${status}`]: false
                    });
                }
            }));
        });
        //Status linking for new tokens
        if (game.settings.get("swade-toolkit", "wound-status-effects")) {
            Hooks.on("createToken", (scene, token, options, id) => {
                this.set_level_effects('token', token._id);
            });
        }
        //Status Linking for NPCs
        Hooks.on("updateToken", (scene, tokenDiff, data, diff, userId) => {
            var _a, _b, _c, _d, _e, _f;
            if (!game.userId == userId || !diff.diff) {
                return;
            } //diff is used to stop propagation after the first sync
            if (game.settings.get("swade-toolkit", "wound-status-effects")) {
                if (((_b = (_a = data === null || data === void 0 ? void 0 : data.actorData) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.fatigue) || ((_d = (_c = data === null || data === void 0 ? void 0 : data.actorData) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.wounds)) {
                    this.set_level_effects('token', tokenDiff._id);
                }
            }
            //sync the sheet and token
            //CAN ONLY DO ONE WAY BINDING
            // Always do Sheet to Token
            // Create a separate listener on tokenHUD that updates sheet when token status is clicked
            if (!tokenDiff.actorLink) {
                let token = canvas.tokens.get(tokenDiff._id);
                let obj = (_f = (_e = data.actorData) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.status;
                if (!obj) {
                    return;
                } //only care if status object is updated
                let tokenEffects = token.actor['effects'];
                for (let status of coreStatusList) {
                    if (obj[`is${status}`] == true && !tokenEffects.find(el => el.data.label == status)) {
                        //it's turned to true AND the status doesn't currently exist on the token
                        token.actor.createEmbeddedEntity('ActiveEffect', {
                            label: status,
                            icon: `systems/swade/assets/icons/status/status_${status.toLowerCase()}.svg`,
                            flags: {
                                core: {
                                    statusId: status.toLowerCase()
                                }
                            }
                        });
                    }
                    else if (obj[`is${status}`] == false && tokenEffects.find(el => el.data.label == status)) {
                        //it's turned off AND there is currently a token effect
                        let effectToDelete = tokenEffects.find(el => el.data.label == status).id;
                        token.actor.deleteEmbeddedEntity("ActiveEffect", effectToDelete);
                    }
                }
            }
            /*
              if(!tokenDiff.actorLink){
                let token:Token = canvas.tokens.get(tokenDiff._id);
            
                let effects = tokenDiff.actorData?.effects;
                /**
                 * CAN ONLY DO ONE WAY BINDING CURRENTLY
                 * Token > Sheet or Sheet > Token (doing both causes infinite loop)
                 * Token > Sheet is preferred because NPCs are quick toggles and you're using the token for them.
                 */
            /*
            if(effects){
              //the status effect was applied on the token
              //source of truth then is the tokendiff.effects
              //we have to apply it to the actorData
              for(let status of coreStatusList){
                if(effects.find(effect => effect.label == status)){
                  //status is on the token, so make sure it's "true" on the actordata
                  token.actor.update({
                    [`data.status.is${status}`]: true
                  })
                } else {
                  //status was REMOVED from the token so make sure it's off the actor
                  token.actor.update({
                    [`data.status.is${status}`]: false
                  })
                }
              }
            }
          }
        */
        });
        //Status Linking for Wildcards
        Hooks.on("createActiveEffect", (actor, activeEffect, opts, userId) => {
            if (game.userId != userId) {
                return;
            }
            for (let status of coreStatusList) {
                if (activeEffect.label == status && !actor.data.data.status[`is${status}`]) {
                    //If the status is the active effect AND it's not currently ON
                    actor.update({
                        [`data.status.is${status}`]: true
                    });
                }
            }
        });
        Hooks.on("deleteActiveEffect", (actor, activeEffect, opts, userId) => {
            if (game.userId != userId) {
                return;
            }
            for (let status of coreStatusList) {
                if (activeEffect.label == status && actor.data.data.status[`is${status}`]) {
                    actor.update({
                        [`data.status.is${status}`]: false
                    });
                }
            }
        });
        // Sheet was changed so make a AE, which will trigger the above hook and make a token 
        Hooks.on("updateActor", (actor, change, opts, userId) => {
            var _a, _b, _c;
            if (game.userId != userId && opts.diff) {
                return;
            }
            if (game.settings.get("swade-toolkit", "wound-status-effects")) {
                if (((_a = change.data) === null || _a === void 0 ? void 0 : _a.fatigue) || ((_b = change.data) === null || _b === void 0 ? void 0 : _b.wounds)) {
                    this.set_level_effects('actor', actor);
                }
            }
            if ((_c = change.data) === null || _c === void 0 ? void 0 : _c.status) {
                for (let status of coreStatusList) {
                    if (change.data.status[`is${status}`]) {
                        //status was changed to true
                        //create active effect
                        if (!actor['effects'].find(el => el.data.label == status)) {
                            //only create it once, if it's already there, no need to create it again
                            actor.createEmbeddedEntity('ActiveEffect', {
                                label: status,
                                icon: `systems/swade/assets/icons/status/status_${status.toLowerCase()}.svg`,
                                flags: {
                                    core: {
                                        statusId: status.toLowerCase()
                                    }
                                }
                            });
                        }
                    }
                    else if (change.data.status[`is${status}`] == false) { //specifically want false and not undefined so it's acted only when changed
                        //status was changed to false
                        //delete active effect
                        let effectToDelete = actor['effects'].find(el => el.data.label == status);
                        if (effectToDelete) {
                            actor.deleteEmbeddedEntity("ActiveEffect", effectToDelete.id);
                        }
                    }
                }
            }
        });
    }
}

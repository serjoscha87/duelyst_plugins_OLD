console.info("running custom script");

(function(c){
	var orig_setGScreate = SDK.GameSession.create;
	SDK.GameSession.create = function() {
		var gs = orig_setGScreate.call(this);
		// At this point we are read to access every class brought by the game
		
		//
		//SDK.PlayModeFactory.playModes.sandbox.isHiddenInUI = false;
		
		/****************************************************
		******************** Check if there is a new addon pack version
		*****************************************************/
		!c.plugins.active.disable_version_check && (function(){
			$.getJSON("http://5133418.swh.strato-hosting.eu/_JOSCH/duelyst_addons_current_version/version.json", function(data) {
				if(data.josch_addons_version_iterative > c.plugins.iVERSION)
					NotificationsManager.instance.showNotification(new Backbone.Model({
						message: "There is a newer verion of Josch's Plugin Scripts // Your version: "+c.plugins.VERSION+" // Newer Version: "+data.josch_addons_version, 
						type: "buddy_invite"
					}));
			});
		}());
		
		/****************************************************
		******************** add some custom css
		*****************************************************/
		$("<style type='text/css'> .ingame_infobox {position:relative;top:40%;color:white;text-align:right;background-color:black;opacity:0.6;padding-right:8px;width:205px;margin-top:2px;float:right;clear:right;margin-right:4px;pointer-events:auto;}</style>").appendTo("head");

		/****************************************************
		******************** Get the Application object
		*****************************************************/
		window.Application = (EventBus.getInstance())._events.show_codex[0].ctx; // abuse the event bus because its designed singleton and gives us an istance of an hidden object ("Application")
		
		/****************************************************
		******************** This function (showActiveGame) is called when all ui DOM elems for a game-match are added and existing. We need it for further features.
		*****************************************************/
		var orig_showActiveGame = custom_plugins.exposedInsts.FXCompositeLayer.prototype.showActiveGame;
		custom_plugins.exposedInsts.FXCompositeLayer.prototype.showActiveGame = function(){
			var ret = orig_showActiveGame.call(this);
			
			console.info("showActiveGame");
			
			/****************************************************
			******************** Create the "Actions left" infobox in DOM
			*****************************************************/
			$(document.createElement('div'))
				.addClass('ingame_infobox')
				.attr('id', 'plugin_ali_box')
				.draggable()
				.appendTo($("#app-game-right-region"));
				
			/****************************************************
			******************** Create the "Special Quest" infobox in DOM 
			TODO these are added regardless the config!
			*****************************************************/
			//var qs = QuestsManager.instance.dailyQuestsCollection._byId;
			// 20000 = welcome back
			var qs = QuestsManager.instance.getQuestCollection().models;
			for(var quest in qs) {
				if( (qs[quest].attributes.quest_type_id == 500 || qs[quest].attributes.quest_type_id == 401) && $('#plugin_sqi_box').length === 0 ) {
					$(document.createElement('div'))
						.addClass('ingame_infobox')
						.attr('id', 'plugin_sqi_box')
						.appendTo($("#app-game-right-region")); //  DRAGGABLE
				}
				if(qs[quest].attributes.quest_type_id == 500)
					window.custom_plugins.has_aggressor_q = true;
				else if(qs[quest].attributes.quest_type_id == 401)
					window.custom_plugins.has_assassin_q = true;
			}

			/****************************************************
			******************** expand the battlelog as soon as possible
			*****************************************************/
			c.plugins.active.expand_battlelog && window.custom_plugins.exposed.battlelog.toggle(this);
			
			//
			return ret;
		}; // showActiveGame END
		
		/****************************************************
		******************** End step handler hook.
		*****************************************************/
		var orig_endStep = gs.__proto__._endStep; // this can only be set as soon as the GameSession is created...
		gs.__proto__._endStep = function(e){  // endStep got an updated gameSession instance; startStep not
			
			var internal_gs = this; // GameSession
			
			//var curr_player_index = (e.playerId == ProfileManager.instance.profile.id ? window.custom_plugins.curr_game_player_index : (window.custom_plugins.curr_game_player_index === 1 ? 0 : 1) ); // << switches every turn
			var curr_game_player_index = window.custom_plugins.curr_game_player_index;
			
			/****************************************************
			******************** "actions left" infobox
			*****************************************************/
			c.plugins.active.actions_left_info && (function(){

				//var last_play_manaCost = e.action._private.cachedCard.manaCost; // this should be easier to obtain
				var mana_remaining = internal_gs.players[curr_game_player_index].getRemainingMana();
				
				var can_play_any_card = false;
				var cachedCards = internal_gs.players[curr_game_player_index].deck._private.cachedCardsInHandExcludingMissing;
				for(var card in cachedCards)
					if(cachedCards[card].manaCost <= mana_remaining)
						can_play_any_card = true;
				
				var did_replace = false;
				for(var step in internal_gs.currentTurn.steps)
					if(internal_gs.currentTurn.steps[step].action.type == "ReplaceCardFromHandAction")
						did_replace = true;
				if (!did_replace && internal_gs.players[curr_game_player_index].deck.hand.filter(function(e){return typeof e=='number'}).length === 0) did_replace = true;
				
				var played_signature = true;
				if(internal_gs.players[curr_game_player_index].getSignatureCards().length !== 0 && mana_remaining >=1) { // was even able to play signature this turn?
					played_signature = false;
					for(var step in internal_gs.currentTurn.steps) // did play signature?
						if(internal_gs.currentTurn.steps[step].action.type == "PlaySignatureCardAction")
							played_signature = true;
				}
				
				// generate string with info of minions that can still attack
				var info_container = $(document.createElement('div'));
				var unit_actions_left_string = '<b style="text-decoration: underline;">Move/Attack with:</b>';
				info_container.append(unit_actions_left_string);
				
				var units_on_board=internal_gs.board.getCards();
				var actions_left=0;
				for(unit in units_on_board) {
					if(units_on_board[unit].ownerId === ProfileManager.instance.profile.id)
						if(
						!units_on_board[unit].getIsExhausted() // not exhausted
							&& // AND
						// (enemy minions in meele range OR could move around OR is ranged minion)
						(internal_gs.board.getEnemyEntitiesAroundEntity(internal_gs.board.getCards()[unit]).length!==0 || units_on_board[unit].getCanMove() || units_on_board[unit].isRanged() ) 
							&& // AND
						!units_on_board[unit].getIsBattlePet() // minion is not a battlepet
						) {
							$(document.createElement('div'))
								.text(units_on_board[unit].name)
								.data({x:units_on_board[unit].position.x,y:units_on_board[unit].position.y})
								.on('mouseenter',function(){
									var x = $(this).data('x');
									var y = $(this).data('y');
									custom_plugins.exposed.FXCompositeLayer.showInstructionalArrowForEntityNode(custom_plugins.exposed.FXCompositeLayer.getEntityNodeAtBoardPosition(x,y));
								})
								.appendTo(info_container);
							//unit_actions_left_string += '<div data-unitid='+unit+'>'+units_on_board[unit].name+"</div>";
							actions_left++;
						}
				}
				!actions_left && (info_container.append("<br/>&mdash;"));
				
				// print stuff
				$('#plugin_ali_box').html(
					'<b style="text-decoration: underline;">Actions left:</b><br/>' +
					(can_play_any_card ? "* Play a card<br/>":'') +
					(!did_replace ? '* Replace<br/>':'') +
					(!played_signature ? '* Bloodborn Spell<br/>':'') +
						( (!can_play_any_card && did_replace && played_signature) ? "&mdash;<br/>":'' ) //+ // only a indicator dash
					//unit_actions_left_string + 
					//( (!can_play_any_card && did_replace && played_signature && actions_left===0) ? '<br/><b style="color:green">No action left</b>':'') //; NO S!
				);
				
				info_container.appendTo($('#plugin_ali_box'));
				
				(!can_play_any_card && did_replace && played_signature && actions_left===0) && (info_container.append('<br/><b style="color:green">No action left</b>'));
				
			}());
				
			/****************************************************
			******************** "special quest" infobox
			*****************************************************/
			// TODO beautify that code part!!!
			c.plugins.active.ig_special_quest_info && (function() {
				if (internal_gs.gameType === SDK.GameType.Gauntlet || internal_gs.gameType === SDK.GameType.Ranked) {
					if(window.custom_plugins.has_aggressor_q || window.custom_plugins.has_assassin_q)
						$('#plugin_sqi_box').html('<b style="text-decoration: underline;">Quest Info:</b>');
					
					if(window.custom_plugins.has_aggressor_q){
						if(internal_gs.players[curr_game_player_index].totalDamageDealt >= 40)
							$('#plugin_sqi_box').append('<div>Ultimate Aggressor: <b color="green">DONE</b>');
						else
							$('#plugin_sqi_box').append('<div>Ultimate Aggressor: '+internal_gs.players[curr_game_player_index].totalDamageDealt+"/40</div>");
					}
					
					if(window.custom_plugins.has_assassin_q){
						if(internal_gs.players[curr_game_player_index].totalMinionsKilled >= 5)
							$('#plugin_sqi_box').append('<div>Assassin: <b color="green">DONE</b>');
						else
							$('#plugin_sqi_box').append('<div>Assassin: '+internal_gs.players[curr_game_player_index].totalMinionsKilled+"/5</div>");
					}
				}
			}());
			// 
			return orig_endStep.call(this,e);
		}; // endStep END
		
		
		/****************************************************
		******************** hook setting of turn time to print the turn time to the end turn button
		*****************************************************/
		c.plugins.active.print_turntime_left && (function(){
			var orig_setTurnTime = gs.__proto__.setTurnTimeRemaining;
			gs.__proto__.setTurnTimeRemaining = function(e) {
				$('.submit-turn').find('div').eq(1).text("turn ("+e+"s)");
				return orig_setTurnTime.call(this, e);
			};
		}());
		
		/****************************************************
		******************** hook start turn
		*****************************************************/
		var orig_showStartTurn = window.custom_plugins.exposedInsts.FXCompositeLayer.prototype.showStartTurn;
		window.custom_plugins.exposedInsts.FXCompositeLayer.prototype.showStartTurn = function(e) {
			var ret = orig_showStartTurn.call(this,e);
			
			var myturn = (SDK.GameSession.getInstance()).players[window.custom_plugins.curr_game_player_index].isCurrentPlayer;
			/****************************************************
			******************** send a toaster notification if the game is in background
			*****************************************************/
			c.plugins.active.turn_notifier && (function(){
				if(myturn) {
					if(!document.hasFocus()){
						if (Notification.permission !== "granted")
							Notification.requestPermission();
						else {
							var notification = new Notification('Duelyst', {
								icon: 'https://duelyst.com/favicon.ico',
								body: "Psssst! Your turn just started!",
							});
						}
					}
				}
			}());
			
			/****************************************************
			******************** part of info box: toggle visibility of the box when turns switch between the player and his opponent
			*****************************************************/
			myturn ? $('#plugin_ali_box').show() : $('#plugin_ali_box').hide();
			//myturn ? $('#plugin_sqi_box').show() : $('#plugin_sqi_box').hide();
			
			//
			return ret;
		} // showStartTurn END
		
		/****************************************************
		******************** match start
		*****************************************************/
		var orig_startGame = window.Application._startGame;
		window.Application._startGame = function() { 
			var ret = orig_startGame.call(this);
			console.info("MATCH STARTED");
			
			window.custom_plugins.curr_game_player_index = ((SDK.GameSession.getInstance()).players[0].playerId == __babas[0].identity.props.id ? 0 : 1); // ProfileManager.instance.profile.id geht auch		
				
			return ret;
		};
		
		//
		return gs;
	} // SDK.GameSession.create END
}({
	plugins : {
		active: {
			disable_version_check	:		false,				// ...
			expand_battlelog		:		true,				// expands the BL on game start automatically
			turn_notifier			:		true,				// do you want toaster notifications on the lower right corner when your turn starts and the game is in background?
			print_turntime_left		:		true,				// ...
			actions_left_info		:		true,				// ...
			ig_special_quest_info	:		true				// ...
		},
		VERSION : '0.8.6', 										// Current version of the plugin pack
		iVERSION : 0
	}
}));


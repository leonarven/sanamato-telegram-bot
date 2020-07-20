const { TelegramBot, OfflineTelegramBot, MessageSender, Chat } = require( './TelegramBot.js' );
const { GameAbstract, Score } = require( './game.js' );

var Game = GameAbstract;
Game.get = ( chat = {} ) => {
	if (typeof chat == "string" || typeof chat == "number") return Game.games[ chat ];

	if (typeof chat != "object" || !chat.id) return null;

	return Game.games[ chat.id ];
};

const argv  = require('minimist')(process.argv.slice(2));
console.log("INIT :: argv:", argv );


const TOKEN     = (argv.token.trim());
const ADMIN_IDS = (argv.admins || "").toString().split( "," ).map( id => id.trim() ).filter( id => id );

if (!TOKEN) throw "Missing parameter --token";

const bot = new (argv.offline ? OfflineTelegramBot : TelegramBot )( TOKEN, { polling: true });
const messageSender = new MessageSender( bot );

Chat.prototype.sendMessage = function( messages, opts ) {
	return messageSender.sendMessage( this.id, messages, opts );
};

bot.on('polling_error', err => {
	console.error( "ERROR at bot.on(polling_error) ::", err );

	if (err.code == "EFATAL") {
		console.error( "Got EFATAL error. Exiting." );
		process.exit();
	} else if (err.code == "ETELEGRAM") {
		if (err.response.statusCode == 409) {
			console.error( "Got ETELEGRAM HTTP 409 (Conflict) error. Exiting." );
			process.exit();
		}
	}
});


bot.on('text', msg => {
	console.debug( "bot.on('text', (msg)) ::", msg );
	const chatId = msg.chat && msg.chat.id || null;
	const chat = msg.chat = Chat.get( msg.chat );

	if (chat) {
		const game = Game.get( chat );

		if (msg.from && !msg.from.is_bot) {
			var user = chat.users[ msg.from.id ];
			if (!user) {
				user = chat.users[ msg.from.id ] = msg.from;
				user.label = user.first_name || user.username || user.id;
			}

			if (game) {
				if (!game.players[ msg.from.id ] && user) {
					game.players[ msg.from.id ] = msg.from;
					game.players[ msg.from.id ].$msgs = [];
					game.players[ msg.from.id ].label = user.label;
				}
				game.players[ msg.from.id ].$msgs.push( msg );
			}
		}
	}
});


/**
 */
if (ADMIN_IDS.length > 0) { 
	bot.onText(/^\/die$/, msg => {
		if (process.uptime() > 2 && ADMIN_IDS.indexOf( msg.from.id.toString() ) != -1) {
			msg.chat.sendMessage( "Minä menen nyt..." ).then(() => process.exit()).catch( err => { });
		}
	});
}


/**
 */
bot.addCommand( "echo", /^\/echo\s+(.+)/, (msg, match) => { msg.chat.sendMessage( match[1] ); });


/**
 */
bot.addCommand( "stop", null, async (msg, match) => {
	const chat = msg.chat, game = Game.get( msg.chat );

	if (chat.$$nextRoundTimeout) {
		clearTimeout( chat.$$nextRoundTimeout ); 
	} else if (!game) {
		return chat.sendMessage( "Ei peliä, joka lopettaa!" );
	} 

	if (game) {
		game.$$abortKisa = true;
		game.stop();
	}

	chat.sendMessage( "Peli keskeytetty!" );
}, "Lopeta nykyinen peli" );


/**
 * Komennon /peli käsittely
 * /peli /^\d+/ = A-pituinen kierros
 * /peli /^\d+/ /^\d+/ = A-pituinen kierros B-kokoisella laudalla
 * /peli /^\d+/ /^\d+/ xyz = A-pituinen kierros B-kokoisella laudalla käyttäen merkistöä xyz
 *
 * @param {number} [match[1]=5]    - Käytetyn laudan koko
 * @param {number} [match[2]=null] - Kierroksen pituus
 * @param {string} [match[3]=FIN]  - Käytetty kirjaimisto tai sen koodi
 *                       -> CMD       |timeout   |size      |chars */
bot.addCommand( "peli", /^\/peli(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?\s*$/, async (msg, match) => {
	if (Game.get( msg.chat )) return msg.chat.sendMessage( `Peli on jo käynnissä. Komenna /stop lopettaaksesi.` );

	const opts = {
		size:    match[1] == null ? 5     : parseInt(match[1]),
		timeout: match[2] == null ? null  : parseInt(match[2]),
		chars:   match[3] == null ? "FIN" : match[3],
		disable_scores: true
	};

	return runKisa( Chat.get( msg.chat.id ), opts ).then(() => {
		msg.chat.sendMessage( "Peli päättyi, kiitos " + String.fromCodePoint( 0x1F60A ));
	});

}, "Aloita yhden kierroksen peruspeli (parametrit: /peli <koko=5> <aika=120> <kirjaimisto=FIN>)." );


/**
 * Komennon /kisa käsittely
 * /kisa /^\d+/ = A-kokoisella laudalla järjestetty manuaalisesti lopetettava peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ = A-kokoisella laudalla järjestetty, B-pituinen peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä, B-pituisia pelejä C-kpl, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ xyz = A-kokoisella laudalla järjestettyjä merkistöä zyx käyttäviä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 *
 * @param {number} (match[1]=5)   - Käytetyn laudan koko
 * @param {number} (match[2]=120) - Kierroksen pituus, jos halutaan
 * @param {number} (match[3=1)]   - Kierrosten lukumäärä
 * @param {number} (match[4])     - Automaatiolla (jos asetettu) määritelty kierrosten välinen aika
 * @param {string} (match[5]=FIN) - Käytetty kirjaimisto tai sen koodi
 */
//                       -> CMD       |size      |timeout   |rounds    |delay     |chars */
bot.addCommand( "kisa", /^\/kisa(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?)?)?\s*$/, async (msg, match) => {
	if (Game.get( msg.chat )) return msg.chat.sendMessage( `Peli on jo käynnissä. Komenna /stop lopettaaksesi.` );

	const opts = {
		size:    match[1] == null ? 5     : parseInt(match[1]),
		timeout: match[2] == null ? 120   : parseInt(match[2]),
		rounds:  match[3] == null ? 1     : parseInt(match[3]),
		delay:   match[4] == null ? null  : parseInt(match[4]),
		chars:   match[5] == null ? "FIN" : match[5]
	};

	runKisa.parseOpts( opts );

	if (!(isFinite( opts.timeout ) && opts.timeout > 0)) {
		throw "Not implemented yet (opts.timeout unsetted)!\nAseta kisan kesto (esim. /kisa 6 120)"; 
	}

	return runKisa( msg.chat, opts ).then( results => {
		if (!opts.disable_scores && opts.rounds >= 1) {
			var scores  = {};
			results.forEach( game => {
				for (var id in game.$scores) {
					var score = game.$scores[ id ];
					if (!scores[ id ]) scores[ id ] = {
						words_count: 0, uniques_count: 0, invalids_count: 0, points: 0,
						player: msg.chat.users[ id ] || chat.game.players[ id ]
					};

					scores[id].words_count    += score.words.length;
					scores[id].uniques_count  += score.uniques.length;
					scores[id].invalids_count += score.invalids.length;
				}
			});

			for (var id in scores) {
				scores[id].points = 0;

				scores[id].points += scores[id].words_count    * 1;
				scores[id].points += scores[id].uniques_count  * 1;
				scores[id].points -= scores[id].invalids_count * 1;
			}

			Object.keys( scores ).sort(( a, b ) => ( a.points - b.points )).forEach(( id, i, ids ) => {
				var score = scores[id], player = score.player;
				var str   = `<b>${ player.label }, ${ score.points } piste${ score.points == 1 ? '' : 'ttä' }:</b>\n`;
				str += `${ score.words_count } hyväksyttyä`;
				if (ids.length > 1) str += `, ${ score.uniques_count } uniikkia`;
				str += ` ja ${ score.invalids_count } hylättyä sanaa.`;
				msg.chat.sendMessage( str, { parse_mode: "HTML" });
			}); 
		}

		msg.chat.sendMessage( "Kilpailu päättyi. Kiitos kaikille " + String.fromCodePoint( 0x1F60A ));
	});
}, "Aloita kilpailu (parametrit: /kisa <koko=5> <aika=120> <kierroksia=1> <kierrosten väli> <kirjaimisto=FIN>)" );




/************************************************/


/**
 * @param {number}  [opts.size=5]               - Käytetyn laudan koko
 * @param {number}  [opts.timeout=Infinity]     - Kierroksen pituus
 * @param {number}  [opts.rounds=1]             - Kierrosten lukumäärä
 * @param {number}  [opts.delay=Infinity]       - Kierrosten välinen aika
 * @param {string}  [opts.chars=FIN]            - Käytetty kirjaimisto tai sen koodi
 * @param {boolean} [opts.disable_scores=false] - Jätetäänkö pisteidenlasku toteuttamatta
 * @return Promise
 */
async function runKisa( chat, opts ) {
	var games = [];

	runKisa.parseOpts( opts );

	if (opts.size > 10) {
		throw `Virheellinen asetus. Laudan sivun pituus voi olla korkeintaan 10 merkkiä (${ opts.size } > 10).`;
	}

	if (opts.rounds > 1 && (typeof opts.delay != "number" || !isFinite( opts.delay ))) {
		throw "Not implemented yet (opts.delay unsetted)!\nUseamman kierroksen kisaa ei voi käynnistää ilman aikavälin asettamista"; 
	}

	if (isFinite( opts.timeout ) && opts.timeout > 0) {
		opts.timeoutFn = game => game.stop();

		opts.timeoutFn.tMinus = { 5: game => chat.sendMessage( `Aikaa jäljellä viisi sekuntia!` ) };

		if (opts.timeout >= 120) opts.timeoutFn.tMinus[60]  = game => chat.sendMessage( `Yksi minuutti aikaa jäljellä.` );
		if (opts.timeout >= 240) opts.timeoutFn.tMinus[120] = game => chat.sendMessage( `Kaksi minuuttia aikaa jäljellä.` );
	}

	return new Promise(( resolve, reject ) => {
		iterateRound( 1, (err, result) => {
			if (err) reject( err );
			else resolve( games );
		});
	});

	function iterateRound( round = 1 , callback ) {
		runRound( round, ( err, game ) => {
			console.log("runRound.callback()");

			if (err) {
				console.error( "ERROR@runRound() ::", err );
				return callback();
			}
		
			games.push( game );

			if (!opts.disable_scores) {
				var scores = game.$scores = game.getScores(), score_txts = [];
				var all_invalids = [];

				console.log( "iterateRound() :: scores:", scores );

				for (var id in scores) {
					var score_txt = "";
					var score = scores[id];
					var words = score.words.map( word => `<i>${ word.toLowerCase() }</i>` );
					score_txt += `\n\n${ game.players[id].label }, `;
					
					if (words.length == 0) {
						score_txt += "ei löydettyjä sanoja."
					} else if (words.length == 1) {
						score_txt += `yksi löydetty sana, ${ words[0] }.`
					} else {
						if (Object.keys( scores ).length == 1) {
							score_txt += `${ words.length } sanaa.`;
						} else {
							if (score.words.length == score.uniques.length) {
								score_txt += `<b>${ words.length } sanaa, kaikki uniikkeja.</b>`;
							} else {
								score_txt += `<b>${ words.length } sanaa, ${ score.uniques.length } uniikkia.</b>`;
							}
						}
				
						score_txt += `\n${ words[0] }`;
						for (var c = words.length, i = c-1; i >= 1; i--) {
							score_txt += (i==1 ? " ja " : ", ") + words[c-i];
						}
						score_txt += ".";
					}

					for (var word of score.invalids) {
						if (all_invalids.indexOf( word ) == -1) all_invalids.push( word );
					}
					all_invalids = all_invalids.map( word => `<i>${ word.toLowerCase() }</i>` );

					for (var word in score.founds) {
						var paths = score.founds[word];
						for (var path of paths) {
//							score_txt += `\n${word} - ${ path }`;
						}
					}

					score_txts.push( score_txt );
				}

				if (score_txts.length == 0) {
					score_txts.unshift( "Aika loppui, peli päättyi. Kukaan ei pelannut " + String.fromCodePoint( 0x1F636 ));
				} else {
					score_txts.unshift( "Aika loppui, peli päättyi.\n<b>Tulokset:</b>" );
				}

				if (all_invalids.length == 1) {
					score_txts.push( `Sanaa ${ all_invalids[0] } ei hyväksytty.`);
				} else if (all_invalids.length > 1) {
					score_txts.push( `Sanoja ${ all_invalids.join( ', ' ) } ei hyväksytty.`);
				}

				chat.sendMessage( score_txts, { parse_mode: 'HTML'} );
			}

			if (opts.rounds > 1) {
				if (round < opts.rounds) {
					if (game.$$abortKisa) {
						chat.sendMessage( `Kisa keskeytetty kierroksessa *#${ round } / ${ opts.rounds }*`, { parse_mode: 'Markdown' });
						console.log("Aborting the kisa!");
					} else {
						chat.sendMessage( `Seuraava kierros alkaa ${ opts.delay } sekunnin kuluttua.`, { parse_mode: 'HTML'} );
						return iterateRound( round+1, callback );
					}
				} 
			}

			callback(); 
		});
	}

	function runRound( round, callback ) {
		var delay = (opts.delay || 0) * 1000;

		// Yli 10s peleissä voidaan varoittaa etukäteen.
		if (round > 1 && delay > 10000) {
			chat.$$nextRoundTimeout = setTimeout(() => {
				chat.sendMessage("Peli jatkuu 5 sekunnin kuluttua!");

				chat.$$nextRoundTimeout = setTimeout( startFn , 5000 );
			}, delay - 5000 );
		} else {
			chat.$$nextRoundTimeout = setTimeout( startFn );
		}

		function startFn() {
			var str = "*Peli alkaa*";

			if (opts.rounds > 1) {
				str += `\nKierros *#${ round } / ${ opts.rounds }*`;
			} else if (opts.rounds == 1) {
			}

			if (isFinite( opts.timeout ) && opts.timeout > 0) str += `, aikaa *${ opts.timeout } sekuntia*`;

			chat.$$nextRoundTimeout = setTimeout(() => {
				const game = new GameAbstract( chat, opts );

				game.on( 'stop', function() {
					delete Game.games[ this.chat.id ];
					callback( null, this );
				});

				chat.sendMessage( str + ".\n```\n" + game.toString() + "```", { parse_mode: "Markdown" });
			});
		}
	};

	/********************************/

}
runKisa.parseOpts = async opts => {
	if (opts.size == null) opts.size = 5;
	else if (typeof opts.size != "number" || opts.size <= 0 || !isFinite(opts.size)) throw "Invalid argument opts.size";

	/**/

	if (opts.timeout == null) opts.timeout = Infinity;
	else if (typeof opts.timeout != "number" || opts.timeout <= 0 || !isFinite(opts.timeout)) throw "Invalid argument opts.timeout";

	/**/

	if (opts.chars == null) opts.chars  = "FIN"; 
	else if (typeof opts.chars != "string" || opts.chars.length == 0) throw "Invalid argument opts.chars";

	opts.chars = opts.chars.toUpperCase().replace( /[^\wÅÄÖ]/g, "");

	/**/

	if (opts.rounds == null) opts.rounds = 1;
	if (typeof opts.rounds != "number" || opts.rounds < 1 || !isFinite(opts.rounds)) throw "Invalid argument opts.rounds";

	/**/

	if (opts.delay == null) opts.delay = Infinity;
	else if (typeof opts.delay != "number" || opts.delay <= 0 || !isFinite(opts.delay)) throw "Invalid argument opts.delay";

	return opts;
}

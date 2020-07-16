/*
@see http://jkorpela.fi/kielikello/kirjtil.html

TAULUKKO 1. Grafeemien frekvenssi koko materiaalissa (n1),
litteroidussa puhekielessä (n2) ja kirjakielessä (n3).

         n1                n2                n3
         f        %        f        %        f        %
1.  a  457 350  11,62  a  160 812  11,14  a  296 538  11,90
2.  i  421 366  10,71  i  156 359  10,83  i  265 007  10,64
3.  t  388 711   9,88  t  145 442  10,07  t  243 269   9,77
4.  n  341 181   8,67  n  125 270   8,68  n  215 911   8,67
5.  e  323 087   8,21  e  118 642   8,22  e  204 445   8,21
6.  s  309 350   7,86  s  113 675   7,87  s  195 675   7,85
7.  l  226 627   5,76  l   85 074   5,89  l  141 553   5,68
8.  o  208 923   5,31  o   78 378   5,43  k  132 990   5,34
9.  k  207 520   5,27  ä   74 880   5,19  o  130 545   5,24
10. u  196 678   5,00  k   74 530   5,16  u  126 164   5,06
11. ä  189 134   4,81  u   70 514   4,88  ä  114 254   4,59
12. m  137 972   3,51  m   55 700   3,86  m   82 272   3,30
13. v   96 316   2,45  v   33 536   2,32  v   62 780   2,52
14. r   85 116   2,16  j   28 370   1,96  r   57 822   2,32
15. j   75 961   1,93  r   27 294   1,89  j   47 591   1,91
16. h   71 733   1,82  y   26 648   1,85  h   45 503   1,83
17. y   71 316   1,81  h   26 230   1,82  y   44 668   1,79
18. p   65 358   1,66  p   22 076   1,53  p   43 282   1,74
19. d   33 148   0,84  d   12 078   0,84  d   21 070   0,85
20. ö   18 655   0,47  ö    6 467   0,45  ö   12 188   0,49
21. g    4 151   0,11  g    1 005   0,07  g    3 146   0,13
22. b    2 068   0,05  b      475   0,03  b    1 593   0,06
23. f    1 934   0,05  f      395   0,03  f    1 539   0,06
24. c    1 091   0,03  c       52   0,00  c    1 041   0,04
25. w      329   0,01  w       22   0,00  w      307   0,01
26. å       52   0,00  å       20   0,00  å       30   0,00
27. q       26   0,00  q        1   0,00  q       25   0,00
                                                           
     3 935 153   100    1 443 945   100    2 491 208   100
     =========          =========          =========

@see https://docs.google.com/spreadsheets/d/1yNwGnnSyYNRLHZqy1gUQ9ug-W80pI9K40fu485PzNtM/edit?usp=sharing
*/
const CHAR_COUNTS = {
	'a':	17590,
	'i':	16206,
	't':	14950,
	'n':	13122,
	'e':	12426,
	's':	11898,
	'l':	8716,
	'o':	8035,
	'k':	7981,
	'u':	7564,
	'ä':	7274,
	'm':	5306,
	'v':	3704,
	'r':	3273,
	'j':	2921,
	'h':	2758,
	'y':	2742,
	'p':	2513,
	'd':	1274,
	'ö':	717,
	'g':	159,
	'b':	79,
	'f':	74,
	'c':	41,
	'w':	12,
	'å':	2,
	'q':	1
};

var CHAR_STR = "";
for (var char in CHAR_COUNTS) CHAR_STR += char.repeat( CHAR_COUNTS[char] );

const TelegramBot = require('node-telegram-bot-api');

const argv  = require('minimist')(process.argv.slice(2));
const token = argv.token;

if (!token) throw "Missing parameter --token";

const bot = new TelegramBot( token, { polling: true });

const games = {};

class Game {
	constructor( cnf = {} ) {
		this.w = cnf.w || 4;
		this.h = cnf.h || 4;

		/** @TODO: selvitä oikean pelin merkit */
		this.charsArr = (cnf.chars || CHAR_STR).split("").map( v => [ v ]);

		this.ctime = new Date();


		this.charsArr.sort(() => Math.random()-.5 );
		this.board = [];
		for (var row, y = 0; y < this.h; y++) {
			this.board.push( row = [] );
			for (var x = 0; x < this.w; x++) {
				var idx = y * this.w + x;
				var chars = this.charsArr[ idx % this.charsArr.length ];
				row.push( chars[ parseInt( Math.random() * chars.length )]);
			}
		}
	}

	toString( opts = {} ) {
		return this.board.map( row => {
			return row.map( char => {
				return "" + char.toUpperCase() + "";
			}).join( "\t" );
		}).join( "\n" );
	}
}

bot.onText(/\/start(\s+\d+)?(\s+\d+)?(\s+\d+)?(\s+[\wåäö]+)?/, (msg, match) => {
	try {
		handleCmdStart( msg, match )
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/start) ::", err );
	}
});

bot.onText(/\/stop/, (msg, match) => {
	try {
		handleCmdStop( msg, match )
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/stop) ::", err );
	}
});

bot.on('polling_error', err => {
	console.error( "ERROR at bot.on(polling_error) ::", err );
});

function handleCmdStart( msg, match ) {
	const chatId = msg.chat.id;

	if (games[ chatId ]) return bot.sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.`, { disable_notification: true } );

	const cnf = {};

	if (match[2]) cnf.h = parseInt(match[2]); 
	if (match[3]) cnf.w = parseInt(match[3]);
	else if (match[2]) cnf.w = cnf.h;

	if (match[4]) cnf.chars = match[4].toLowerCase().replace( /[^\wåäö]/g , "");

	const game = games[ chatId ] = new Game( cnf );

	bot.sendMessage( chatId, `Peli aloitettu ${ game.ctime.toLocaleString() }!` );

	if (match[1]) {
		var timeout_s = parseInt( match[1] );
		if (timeout_s > 0) { 

			game.$timeout = setTimeout(() => {
				delete games[ chatId ];
				bot.sendMessage( chatId, `Aika loppui! Peli päättyi.`, { disable_notification: true } );
			}, timeout_s * 1000 );
			game.$timeouts = [ game.$timeout ];

			
			if (timeout_s > 20) {
				game.$timeouts.push( setTimeout(() => {
					bot.sendMessage( chatId, `Aikaa jäljellä viisi sekuntia!`, { disable_notification: true } );
				}, (timeout_s - 5) * 1000 ));
			}

			bot.sendMessage( chatId, `Ajastettu päättymään ${ timeout_s } sekunnin kuluttua`, { disable_notification: true } );
		}
	}

	return bot.sendMessage( chatId, "```\n" + game.toString() + "```", { parse_mode: "Markdown", disable_notification: true });

	new Promise(( resolve, reject ) => {
		try {
			const canvas = require( "./StrArrToImage.js" )( game.board );

			bot.sendPhoto( chatId, canvas.createPNGStream(), {}, { contentType: "image/png" }).then(resolve).catch(reject);
		} catch( err ) { reject( err ); }
	}).then( response => {
		console.log("hereiam", response);
	}).catch( err => {
		console.error( err );

		return bot.sendMessage( chatId, "```\n" + game.toString() + "```", { parse_mode: "Markdown" });
	}).then( response => {
		console.log( "hereiam2", response );
	});
}

function handleCmdStop( msg, match ) {
	const chatId = msg.chat.id;
	const game = games[ chatId ];

	if (!game) return bot.sendMessage( chatId, "Ei peliä, joka lopettaa!", { disable_notification: true } );

	if (game.$timeout) for (var timeout of game.$timeouts) clearTimeout( timeout );

	delete games[ chatId ];

	bot.sendMessage( chatId, "Peli lopetettu!", { disable_notification: true } );
}

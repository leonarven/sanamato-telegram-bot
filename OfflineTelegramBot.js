class OfflineTelegramBot {
	constructor( token, config ) {

	}

	on() {}

	onText() {}
}

const chats = {};
class Chat {
	constructor( chat = {} ) {
		for (var id in chat) this[id] = chat[id];

		Object.defineProperty( this, 'title', {
			get: () => {
				switch (this.type) {
					case "private": return this.username;
				}
				return this.id;
			}
		});

		console.debug( "new Chat() ::", this );
	}

	static get( chat = {} ){
		if (typeof chat == "string" || typeof chat == "number") return chats[ chat ];

		if (typeof chat != "object" || !chat.id) return null;

		return (chats[ chat.id ] = chats[ chat.id ] || new Chat( chat ));
	}
}


module.exports      = OfflineTelegramBot;
module.exports.Chat = Chat;

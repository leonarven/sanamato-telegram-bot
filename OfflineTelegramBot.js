class OfflineTelegramBot {
	constructor( token, config ) {

	}

	on() {}

	onText() {}
}


class Chat {
	constructor( chatId, msgChat = {}) {
		this.id   = chatId;
		this.type = msgChat.type;

		switch (this.type) {
			case "private":
				this.title = msgChat.username;
				break;
			default:
				this.title = msgChat.title || chatId;
		}

		console.debug( "new Chat() ::", this );
	}
}


module.exports      = OfflineTelegramBot;
module.exports.Chat = Chat;

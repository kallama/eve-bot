eve-bot
============
Discord bot for [https://github.com/R4stl1n/allianceauth](https://github.com/R4stl1n/allianceauth)

### Features
Announces Discord users that are not using their EVE character name  
Announces Discord users not on auth  
Announce add/delete for fleet and structure timers

### Requires
Node.js v4.0.0+

####To use mysql-events
SQL Commands:

	mysql> SET GLOBAL server_id = 1;
	mysql> GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO 'allianceserver'@'localhost';

Edit your /etc/mysql/my.cnf file and add

	# binlog config
	server-id        = 1
	log_bin          = /var/log/mysql/mysql-bin.log
	expire_logs_days = 10            # optional
	max_binlog_size  = 100M          # optional

restart mysql server

	sudo service mysql restart

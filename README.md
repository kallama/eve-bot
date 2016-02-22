eve-bot
============
Discord bot for [https://github.com/R4stl1n/allianceauth](https://github.com/R4stl1n/allianceauth)

### Features
Announces Discord users that are not using their EVE character name  
Announces Discord users not on auth  
Announce add/update/delete for fleet and structure timers  
Announce timer 60, 30, and 5 minutes before  
Parses zkillboard kill links in chat  
Announces alliance/corp kills and losses to a defined channel  

### Requires
Node.js v4.0.0+

#### To use mysql-events
Run the following SQL commands as the mysql root user:

	mysql> SET GLOBAL server_id = 1;
	mysql> GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO 'allianceserver'@'localhost';

Edit your /etc/mysql/my.cnf file and add the following under [mysqld]

	# binlog config
	server-id        = 1
	log_bin          = /var/log/mysql/mysql-bin.log
	expire_logs_days = 10            # optional
	max_binlog_size  = 100M          # optional
  binlog_format    = row

restart mysql server

	sudo service mysql restart


#### mySQL tables
Add the **mysql_eve_map_solarsystems.txt.gz** and **mysql_eve_inv_types.txt.gz** mySQL tables from http://eve-marketdata.com/developers/mysql.php to the alliance_auth DB

	# wget http://eve-marketdata.com/developers/mysql_eve_map_solarsystems.txt.gz
	# gunzip mysql_eve_map_solarsystems.txt.gz
	# wget http://eve-marketdata.com/developers/mysql_eve_inv_types.txt.gz
	# gunzip mysql_eve_inv_types.txt.gz
	# mysql -u allianceserver -p alliance_auth < mysql_eve_map_solarsystems.txt
	# mysql -u allianceserver -p alliance_auth < mysql_eve_inv_types.txt

FROM mysql:8.0
COPY ./testdump.sql /docker-entrypoint-initdb.d/


CMD [ "mysqld", "--default-authentication-plugin=mysql_native_password" ]
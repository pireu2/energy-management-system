CREATE DATABASE user_management;
CREATE DATABASE device_management;
CREATE DATABASE auth_db;

GRANT ALL PRIVILEGES ON DATABASE user_management TO energy_user;
GRANT ALL PRIVILEGES ON DATABASE device_management TO energy_user;
GRANT ALL PRIVILEGES ON DATABASE auth_db TO energy_user;

\c user_management;
GRANT ALL ON SCHEMA public TO energy_user;

\c device_management;
GRANT ALL ON SCHEMA public TO energy_user;

\c auth_db;
GRANT ALL ON SCHEMA public TO energy_user;
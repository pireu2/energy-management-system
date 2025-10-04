import { AppDataSource } from "./database";

const initializeDatabase = async () => {
  try {
    let retries = 5;
    while (retries) {
      try {
        await AppDataSource.initialize();
        console.log("TypeORM DataSource has been initialized successfully");

        if (process.env.NODE_ENV === "development") {
          await AppDataSource.synchronize();
          console.log("Database synchronized");
        }

        break;
      } catch (error) {
        console.log(`Database connection failed, retries left: ${retries - 1}`);
        retries -= 1;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    console.error("Error initializing TypeORM DataSource:", error);
    throw error;
  }
};
export default initializeDatabase;

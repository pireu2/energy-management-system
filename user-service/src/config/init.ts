import { AppDataSource } from "./database";

const initializeDatabase = async () => {
  try {
    let retries = 5;
    while (retries) {
      try {
        await AppDataSource.initialize();

        if (process.env.NODE_ENV === "development") {
          await AppDataSource.synchronize();
        }

        break;
      } catch (error) {
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

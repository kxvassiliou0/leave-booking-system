import { Department, LeaveRequest, Role, User } from '@entities'
import { config } from 'dotenv'
import { DataSource } from 'typeorm'

config()

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities: [Department, LeaveRequest, Role, User],
  migrations: ['src/migrations/*.ts'],
})

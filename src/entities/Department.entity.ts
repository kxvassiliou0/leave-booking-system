import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { User } from './User.entity.ts'

@Entity()
export class Department {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string

  @OneToMany(() => User, (user: User) => user.department)
  users!: User[]
}

import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm'

export class InitialSchema1742428800000 implements MigrationInterface {
  name = 'InitialSchema1742428800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'department',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
        ],
      }),
      true
    )

    await queryRunner.createTable(
      new Table({
        name: 'user',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'firstName', type: 'varchar', length: '255', isNullable: false },
          { name: 'lastName', type: 'varchar', length: '255', isNullable: false },
          { name: 'email', type: 'varchar', length: '255', isUnique: true, isNullable: false },
          { name: 'password', type: 'varchar', length: '255', isNullable: false },
          { name: 'role', type: 'varchar', length: '255', isNullable: false },
          { name: 'annualLeaveAllowance', type: 'int', default: 28, isNullable: false },
          { name: 'departmentId', type: 'int', isNullable: false },
          { name: 'managerId', type: 'int', isNullable: true },
        ],
      }),
      true
    )

    await queryRunner.createTable(
      new Table({
        name: 'leave_request',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'startDate', type: 'date', isNullable: false },
          { name: 'endDate', type: 'date', isNullable: false },
          { name: 'daysRequested', type: 'int', isNullable: false },
          {
            name: 'leaveType',
            type: 'varchar',
            length: '255',
            default: "'Vacation'",
            isNullable: false,
          },
          { name: 'reason', type: 'text', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '255',
            default: "'Pending'",
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          { name: 'userId', type: 'int', isNullable: false },
          { name: 'reviewedById', type: 'int', isNullable: true },
        ],
      }),
      true
    )

    // user → department
    await queryRunner.createForeignKey(
      'user',
      new TableForeignKey({
        columnNames: ['departmentId'],
        referencedTableName: 'department',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      })
    )

    // user → user (self-ref manager)
    await queryRunner.createForeignKey(
      'user',
      new TableForeignKey({
        columnNames: ['managerId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      })
    )

    // leave_request → user (submitter)
    await queryRunner.createForeignKey(
      'leave_request',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      })
    )

    // leave_request → user (reviewer)
    await queryRunner.createForeignKey(
      'leave_request',
      new TableForeignKey({
        columnNames: ['reviewedById'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      })
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const leaveTable = await queryRunner.getTable('leave_request')
    if (leaveTable) {
      for (const fk of leaveTable.foreignKeys) {
        await queryRunner.dropForeignKey('leave_request', fk)
      }
    }

    const userTable = await queryRunner.getTable('user')
    if (userTable) {
      for (const fk of userTable.foreignKeys) {
        await queryRunner.dropForeignKey('user', fk)
      }
    }

    await queryRunner.dropTable('leave_request', true)
    await queryRunner.dropTable('user', true)
    await queryRunner.dropTable('department', true)
  }
}

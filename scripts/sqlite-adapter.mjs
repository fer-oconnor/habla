import {DatabaseSync} from 'node:sqlite';

// Small synchronous adapter for the disposable QA/reference databases. The
// production application still uses Cloudflare D1 and is unchanged.
export default class Database {
  constructor(file) { this.database=new DatabaseSync(file); }
  exec(sql) { return this.database.exec(sql); }
  prepare(sql) {
    const statement=this.database.prepare(sql);
    return {
      get(...args) { return statement.get(...args); },
      all(...args) { return statement.all(...args); },
      run(...args) { return statement.run(...args); },
      // Used only for SELECT * on the curriculum's unique column names.
      raw() { return {
        all(...args) { return statement.all(...args).map(row=>Object.values(row)); },
        get(...args) { const row=statement.get(...args);return row===undefined?undefined:Object.values(row); },
      }; },
    };
  }
  transaction(operation) {
    return (...args)=>{
      this.database.exec('BEGIN');
      try {
        const result=operation(...args);
        this.database.exec('COMMIT');
        return result;
      } catch(error) {
        this.database.exec('ROLLBACK');
        throw error;
      }
    };
  }
  close() { this.database.close(); }
}

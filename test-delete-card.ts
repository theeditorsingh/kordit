import { deleteCardAction } from './src/actions/boardActions';

async function main() {
  try {
    await deleteCardAction('board-1', 'card-2');
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
}
main();

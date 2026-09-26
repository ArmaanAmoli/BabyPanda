import {expect , test } from "bun:test";
import {cleanMessageHistroy} from "../cleanMessageHistory"
import {getMessages} from '@baby-panda/db'
test("Typesafe extraction of tool result and messages" , async ()=>{
    const messageHistory = await getMessages('14a5444a-466e-49ef-96a1-9b7139d8f42e')
    expect(() => cleanMessageHistroy(messageHistory)).not.toThrowError();
});
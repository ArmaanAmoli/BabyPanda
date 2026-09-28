import {expect , test } from "bun:test";
import {cleanMessageHistroy} from "../cleanMessageHistory"
import {getMessages} from '@baby-panda/db'
test("Typesafe extraction of tool result and messages" , async ()=>{
    const messageHistory = await getMessages('acc0899b-9876-4de2-8ac4-78b3ad4201be')
    expect(() => cleanMessageHistroy(messageHistory)).not.toThrowError();
});